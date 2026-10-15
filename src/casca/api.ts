/**
 * A conversa com a API da Lareia (spec 96 §4.5):
 *
 *   POST   /aparelhos/parear           {codigo, nome, anterior?}  → 201 {chave, aparelho}   (sem credencial)
 *   GET    /compartilhar/nota/listas                              → {listas: [{listaId, nome, total}]}
 *   POST   /compartilhar/nota          {bytes}                    → {pacoteId, upload: {url, campos}}
 *   (o POST assinado ao S3, com o zip)
 *   POST   /compartilhar/nota/{id}     o envio                    → {articleId, acao, lista?, temaIgnorado?, pacote}
 *   DELETE /aparelhos/este                                        → 204
 *
 * A credencial é a chave do aparelho `lap1.…`, de alcance `nota`, no
 * cabeçalho `Authorization: Chave …`. Ela vem do cofre a cada chamada e não
 * passa por mais lugar nenhum: nem ajustes, nem registro, nem mensagem de erro.
 * O código de pareamento só atravessa `parear`, e morre no uso.
 *
 * Só dois destinos (I16): a base da API dos ajustes, e o endereço do POST
 * assinado — que vem do servidor e só se aceita se for o S3 da AWS por https.
 */

import type { Pedido, Rede, Resposta, ListaDeLeitura } from "./portas.ts";
import { montarFormulario, fronteiraPara } from "../nucleo/multipart.ts";

/** A chave que o porteiro recusa: 401/403 SEM o `type` de um problema (revogada, vencida, fora do alcance — ou o freio por IP). */
export class ChaveRecusada extends Error {}
/** O pareamento recusou o código: forma torta (400) ou desconhecido, vencido, usado (401). */
export class CodigoRecusado extends Error {
  forma: boolean;
  constructor(mensagem: string, forma: boolean) {
    super(mensagem);
    this.forma = forma;
  }
}
/** 409 `aparelhos-demais`: a conta já tem 10 aparelhos. */
export class AparelhosDemais extends Error {}
/** Uma recusa com problema (`application/problem+json`): o slug, o título e o detalhe do servidor. */
export class RecusaDaLareia extends Error {
  status: number;
  slug: string | null;
  detalhe: string;
  corpo: Record<string, unknown>;
  constructor(status: number, slug: string | null, detalhe: string, corpo: Record<string, unknown>) {
    super(`${status} ${slug ?? ""} ${detalhe}`.trim());
    this.status = status;
    this.slug = slug;
    this.detalhe = detalhe;
    this.corpo = corpo;
  }
}
/** A rede caiu, ou a resposta veio sem forma: tentar de novo. */
export class FalhaDeRede extends Error {}
/** O endereço do POST assinado não é o S3. Nada sobe. */
export class DestinoRecusado extends Error {
  host: string;
  constructor(host: string) {
    super(`destino fora do S3: ${host}`);
    this.host = host;
  }
}

export interface Pareamento {
  chave: string;
  aparelho: { aparelhoId: string; nome?: string };
}

export interface Upload {
  url: string;
  campos: Record<string, string>;
}

export interface CorpoDoEnvio {
  sourceUrl: string;
  titulo: string;
  autor?: string;
  resumo?: string;
  publishedAt?: string;
  vaultPath?: string;
  idioma?: string;
  tema?: string;
  listaId?: string;
}

export interface ResultadoDaLista {
  nome?: string;
  listaId?: string;
  acao?: string;
  lugar?: string;
  posicao?: number | null;
}

export interface ResultadoDoEnvio {
  articleId: string;
  acao: string;
  lista?: ResultadoDaLista;
  temaIgnorado?: unknown;
  pacote?: { faltaram?: unknown[]; [k: string]: unknown };
}

type Objeto = Record<string, unknown>;

function lerJson(r: Resposta): Objeto {
  try {
    const v: unknown = r.texto ? JSON.parse(r.texto) : {};
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : {};
  } catch {
    return {};
  }
}

/** O slug do problema: o fim do `type` (`https://leitor/erros/{slug}`), ou o `slug`. */
function slugDe(j: Objeto): string | null {
  if (typeof j.slug === "string") return j.slug;
  if (typeof j.type === "string" && j.type.includes("/")) return j.type.slice(j.type.lastIndexOf("/") + 1);
  return null;
}

/** O S3 da AWS por https: `{balde}.s3.{região}.amazonaws.com` ou `s3.{região}.amazonaws.com`. */
export function ehS3(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && u.port === "" && /^(?:[a-z0-9.-]+\.)?s3[.-](?:[a-z0-9-]+\.)?amazonaws\.com$/.test(u.hostname);
}

const hostDe = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 60);
  }
};

const sorte = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

export class ClienteDaApi {
  private rede: Rede;
  private base: string;
  private chave: () => string | null;

  constructor(rede: Rede, base: string, chave: () => string | null) {
    this.rede = rede;
    this.base = base.replace(/\/+$/, "");
    this.chave = chave;
  }

  private async pedir(p: Pedido, rotulo: string): Promise<Resposta> {
    try {
      return await this.rede.pedir(p);
    } catch (e) {
      throw new FalhaDeRede(`${rotulo}: ${(e as Error).message}`);
    }
  }

  private async chamar(metodo: Pedido["metodo"], caminho: string, corpo?: unknown): Promise<Objeto> {
    const chave = this.chave();
    if (!chave) throw new ChaveRecusada("este aparelho não está ligado");
    const r = await this.pedir(
      {
        url: this.base + caminho,
        metodo,
        cabecalhos: { Authorization: `Chave ${chave}`, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
        corpo: corpo === undefined ? undefined : JSON.stringify(corpo),
      },
      `${metodo} ${caminho}`,
    );
    const j = lerJson(r);
    if ((r.status === 401 || r.status === 403) && j.type === undefined) throw new ChaveRecusada(`${r.status}`);
    if (r.status >= 400) throw new RecusaDaLareia(r.status, slugDe(j), typeof j.detail === "string" ? j.detail : typeof j.title === "string" ? j.title : "", j);
    return j;
  }

  /** `POST /aparelhos/parear` — a única chamada sem chave, e a única resposta que traz uma. */
  async parear(codigo: string, nome: string, anterior: string | null): Promise<Pareamento> {
    const r = await this.pedir(
      {
        url: this.base + "/aparelhos/parear",
        metodo: "POST",
        cabecalhos: { "Content-Type": "application/json" },
        corpo: JSON.stringify(anterior ? { codigo, nome, anterior } : { codigo, nome }),
      },
      "POST /aparelhos/parear",
    );
    const j = lerJson(r);
    const slug = slugDe(j);
    if (r.status === 400) throw new CodigoRecusado(slug || "codigo-invalido", true);
    if (r.status === 401) throw new CodigoRecusado(slug || "codigo-recusado", false);
    if (r.status === 409 && slug === "aparelhos-demais") throw new AparelhosDemais(slug);
    if (r.status >= 400) throw new FalhaDeRede(`POST /aparelhos/parear: ${r.status} ${slug ?? ""}`.trim());
    const aparelho = j.aparelho as Objeto | null | undefined;
    if (typeof j.chave !== "string" || !aparelho || typeof aparelho !== "object" || typeof aparelho.aparelhoId !== "string") {
      throw new FalhaDeRede("POST /aparelhos/parear: resposta sem a chave");
    }
    return { chave: j.chave, aparelho: { aparelhoId: aparelho.aparelhoId, ...(typeof aparelho.nome === "string" ? { nome: aparelho.nome } : {}) } };
  }

  async listas(): Promise<ListaDeLeitura[]> {
    const j = await this.chamar("GET", "/compartilhar/nota/listas");
    const l = Array.isArray(j.listas) ? j.listas : [];
    return l
      .filter((x): x is Objeto => !!x && typeof x === "object" && typeof (x as Objeto).listaId === "string" && typeof (x as Objeto).nome === "string")
      .map((x) => ({ listaId: x.listaId as string, nome: x.nome as string, ...(typeof x.total === "number" ? { total: x.total } : {}) }));
  }

  async pedirPacote(bytes: number): Promise<{ pacoteId: string; upload: Upload }> {
    const j = await this.chamar("POST", "/compartilhar/nota", { bytes });
    const u = j.upload as Objeto | undefined;
    const campos = u?.campos;
    if (
      typeof j.pacoteId !== "string" ||
      !u ||
      typeof u.url !== "string" ||
      !campos ||
      typeof campos !== "object" ||
      !Object.values(campos as Objeto).every((v) => typeof v === "string")
    ) {
      throw new FalhaDeRede("POST /compartilhar/nota: resposta sem o upload");
    }
    return { pacoteId: j.pacoteId, upload: { url: u.url, campos: campos as Record<string, string> } };
  }

  /** O POST assinado: os campos e o zip, direto ao S3. Sem a chave: a assinatura é a autorização. */
  async subir(upload: Upload, zip: Uint8Array): Promise<void> {
    if (!ehS3(upload.url)) throw new DestinoRecusado(hostDe(upload.url));
    const f = montarFormulario(upload.campos, { nome: "nota.zip", tipo: "application/zip", bytes: zip }, fronteiraPara(zip, sorte));
    const r = await this.pedir({ url: upload.url, metodo: "POST", cabecalhos: { "Content-Type": f.tipo }, corpo: f.corpo }, "upload");
    if (r.status >= 300) {
      const codigo = /<Code>([^<]+)<\/Code>/.exec(r.texto)?.[1] ?? `HTTP ${r.status}`;
      throw new RecusaDaLareia(r.status, "upload-recusado", codigo, {});
    }
  }

  async publicar(pacoteId: string, envio: CorpoDoEnvio): Promise<ResultadoDoEnvio> {
    const j = await this.chamar("POST", `/compartilhar/nota/${encodeURIComponent(pacoteId)}`, envio);
    if (typeof j.articleId !== "string" || typeof j.acao !== "string") throw new FalhaDeRede("POST /compartilhar/nota/{pacoteId}: resposta sem o artigo");
    return j as unknown as ResultadoDoEnvio;
  }

  /** `DELETE /aparelhos/este`: o plugin se desliga, revogando a própria chave. */
  async desligar(): Promise<void> {
    await this.chamar("DELETE", "/aparelhos/este");
  }
}

/**
 * O código como a pessoa o digitou → os 8 caracteres que o servidor espera, ou
 * `null` se a forma estiver torta. Base32 de Crockford sem `I L O U`, com ou sem
 * hífen, em qualquer caixa. Conferir aqui poupa uma chamada e diz o erro na hora.
 */
export function normalizarCodigo(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const c = bruto.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(c) ? c : null;
}
