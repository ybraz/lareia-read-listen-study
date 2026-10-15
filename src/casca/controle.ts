/**
 * O controle do plugin: o pareamento, o envio e o desligar — sem nada do
 * Obsidian. O `main.ts` só liga isto às telas e aos comandos; o script de
 * `scripts/` liga isto a uma pasta e ao `fetch`.
 *
 * Dois estados por aparelho: **ligado** (há a chave no cofre deste aparelho)
 * ou não. Não há «quem escreve»: o envio é de mão única e sem estado de
 * entrega, e o Mac e o iPad do mesmo vault pareiam cada um e mandam cada um;
 * a mesma nota mandada dos dois dá o mesmo artigo, porque a identidade mora
 * na nota (§4.3, I8).
 *
 * O envio, em ordem:
 *
 *   1. lê a nota e a identidade dela (a linha `lareia-leitor`, ou a nova);
 *   2. com a linha: confere a cópia no registro deste aparelho (I10);
 *      sem a linha: o primeiro envio — o modal (tema, lista, idioma);
 *   3. escreve a linha ANTES de mandar (I11): o pior caso de uma falha entre
 *      os dois passos é uma identidade guardada sem artigo, nunca um artigo
 *      cuja identidade a nota não guarda;
 *   4. resolve as figuras, monta o zip e confere os tetos no aparelho;
 *   5. pede o pacote, sobe o zip ao S3, publica o envio;
 *   6. anota no registro e diz o que houve, e o que não foi.
 *
 * O reenvio não toca a nota e não manda tema nem lista (I12).
 */

import type { Ajustes } from "./ajustes.ts";
import { normalizar } from "./ajustes.ts";
import {
  AparelhosDemais,
  ChaveRecusada,
  ClienteDaApi,
  CodigoRecusado,
  DestinoRecusado,
  FalhaDeRede,
  RecusaDaLareia,
  normalizarCodigo,
  type CorpoDoEnvio,
  type ResultadoDoEnvio,
} from "./api.ts";
import type { Ambiente, ArmazemDeAjustes, Cofre, EscolhaDoEnvio, Local, Notas, Rede, Tela } from "./portas.ts";
import { daLinha, escreverLinha, novaIdentidade } from "../nucleo/identidade.ts";
import { montarEnvio, type Envio } from "../nucleo/montagem.ts";
import { figurasCitadas, resolverFiguras, type Resolucao } from "../nucleo/figuras.ts";
import { criarZip, DATA_FIXA, tamanhoDoZip, type EntradaDoZip } from "../nucleo/zip.ts";
import { IDIOMAS_DECLARAVEIS, TEMAS, TETOS } from "../nucleo/tetos.ts";
import { T } from "../nucleo/textos.ts";

export type Estado = { tipo: "ligado" } | { tipo: "sem-ligacao" };

export interface Portas {
  notas: Notas;
  rede: Rede;
  cofre: Cofre;
  local: Local;
  ambiente: Ambiente;
  tela: Tela;
  armazem: ArmazemDeAjustes;
}

/** O que um envio deu, para quem chamou (os testes, o script). */
export type Desfecho =
  | { tipo: "enviado"; resultado: ResultadoDoEnvio; envio: Envio; resolucao: Resolucao }
  | { tipo: "parou"; motivo: string };

/** Quantas recusas seguidas da chave antes de esquecê-la: o «não» do porteiro é o mesmo para revogada, freio por IP e banco fora. */
export const RECUSAS_ATE_ESQUECER = 3;

const nomeDoArquivo = (c: string) => c.slice(c.lastIndexOf("/") + 1);
const pastaDe = (c: string) => (c.includes("/") ? c.slice(0, c.lastIndexOf("/")) : "");
const cod = new TextEncoder();

export class Controle {
  ajustes!: Ajustes;
  private p: Portas;
  private indo = new Set<string>();

  constructor(portas: Portas) {
    this.p = portas;
  }

  async carregar(): Promise<Ajustes> {
    const { ajustes, mudou } = normalizar(await this.p.armazem.carregar());
    this.ajustes = ajustes;
    if (mudou) await this.salvar();
    return ajustes;
  }

  async salvar(): Promise<void> {
    // O que vai ao `data.json` é a forma normalizada, e só ela: campo nenhum entra por fora (I5).
    await this.p.armazem.gravar(normalizar(this.ajustes).ajustes);
  }

  private chaveLocal(nome: string) {
    return `${this.ajustes.idDoVault}:${nome}`;
  }

  private chave(): string | null {
    return this.p.cofre.ler(this.ajustes.nomeDoSegredo) || null;
  }

  private api(): ClienteDaApi {
    return new ClienteDaApi(this.p.rede, this.ajustes.api, () => this.chave());
  }

  estado(): Estado {
    return this.chave() ? { tipo: "ligado" } : { tipo: "sem-ligacao" };
  }

  // ── O pareamento ──────────────────────────────────────────────────────────

  /** Troca o código pela chave e a guarda no cofre. O mesmo caminho do modal e do link `obsidian://`. */
  async parear(codigoBruto: unknown): Promise<boolean> {
    const codigo = normalizarCodigo(codigoBruto);
    if (!codigo) {
      this.p.tela.avisar(T().codigoTorto);
      return false;
    }
    const anterior = this.chave() ? this.p.local.ler<string>(this.chaveLocal("aparelhoId")) : null;
    let par;
    try {
      par = await this.api().parear(codigo, this.p.ambiente.sistema(), anterior);
    } catch (e) {
      if (e instanceof CodigoRecusado) this.p.tela.avisar(e.forma ? T().codigoSemForma : T().codigoRecusado);
      else if (e instanceof AparelhosDemais) this.p.tela.avisar(T().aparelhosDemais);
      else this.p.tela.avisar(T().semFalarComALareia((e as Error).message));
      return false;
    }
    this.p.cofre.gravar(this.ajustes.nomeDoSegredo, par.chave);
    this.p.local.gravar(this.chaveLocal("aparelhoId"), par.aparelho.aparelhoId);
    this.p.local.gravar(this.chaveLocal("recusas"), 0);
    this.p.tela.avisar(T().ligou);
    return true;
  }

  /** `obsidian://lareia-read-listen-study?codigo=…` — o mesmo pareamento do modal. */
  async aoAbrirLink(params: Record<string, string | undefined>): Promise<boolean> {
    if (!params.codigo) {
      this.p.tela.avisar(T().linkSemCodigo);
      return false;
    }
    return this.parear(params.codigo);
  }

  /** O segredo sai do cofre, e o que é deste aparelho sai do armazenamento local. */
  private esquecerEsteAparelho(): void {
    this.p.cofre.esquecer(this.ajustes.nomeDoSegredo);
    this.p.local.gravar(this.chaveLocal("aparelhoId"), null);
    this.p.local.gravar(this.chaveLocal("recusas"), 0);
  }

  /** «Desligar este aparelho»: `DELETE /aparelhos/este`, e o segredo sai. */
  async desligar(): Promise<boolean> {
    if (this.estado().tipo !== "ligado") {
      this.p.tela.avisar(T().aparelhoNaoLigado);
      return false;
    }
    try {
      await this.api().desligar();
    } catch (e) {
      if (!(e instanceof ChaveRecusada)) {
        // Sem a resposta, a chave pode seguir viva no servidor: apagá-la daqui
        // deixaria uma ligação que ninguém mais consegue desligar deste lado.
        this.p.tela.avisar(T().naoDesligou((e as Error).message));
        return false;
      }
    }
    this.esquecerEsteAparelho();
    this.p.tela.avisar(T().desligou);
    return true;
  }

  // ── O envio ───────────────────────────────────────────────────────────────

  /** «Enviar ao Leitor» na nota `caminho`. Uma vez por nota de cada vez. */
  async enviar(caminho: string): Promise<Desfecho> {
    if (!caminho.toLowerCase().endsWith(".md")) return this.parou(T().soMarkdown, "nao-e-md");
    if (this.estado().tipo !== "ligado") return this.parou(T().naoLigado, "sem-ligacao");
    if (this.indo.has(caminho)) return this.parou(T().jaEnviando, "ja-indo");
    this.indo.add(caminho);
    try {
      return await this.enviarJa(caminho);
    } catch (e) {
      return this.tratarFalha(e);
    } finally {
      this.indo.delete(caminho);
    }
  }

  private parou(mensagem: string, motivo: string): Desfecho {
    this.p.tela.avisar(mensagem);
    return { tipo: "parou", motivo };
  }

  private registro(): Record<string, string> {
    return this.p.local.ler<Record<string, string>>(this.chaveLocal("registro")) ?? {};
  }

  private escolhaDaPasta(pasta: string): EscolhaDoEnvio | null {
    return (this.p.local.ler<Record<string, EscolhaDoEnvio>>(this.chaveLocal("escolhas")) ?? {})[pasta] ?? null;
  }

  private lembrarEscolha(pasta: string, e: EscolhaDoEnvio) {
    const todas = this.p.local.ler<Record<string, EscolhaDoEnvio>>(this.chaveLocal("escolhas")) ?? {};
    todas[pasta] = e;
    this.p.local.gravar(this.chaveLocal("escolhas"), todas);
  }

  private async enviarJa(caminho: string): Promise<Desfecho> {
    const lido = await this.p.notas.lerTexto(caminho);
    if (lido === null) return this.parou(T().notaNaoExiste(caminho), "nao-existe");
    // Os embeds AGORA, com as posições da nota como foi lida: depois de escrita
    // a linha, o `metadataCache` relê a nota quando quiser, e as posições mudam.
    const embeds = this.p.ambiente.embeds(caminho) ?? [];
    let texto = lido;
    let fm = this.p.ambiente.frontmatter(texto);
    const montagem = { modo: this.ajustes.identidade, secoes: this.ajustes.secoesQueNaoVao };
    let envio = montarEnvio({ caminho, texto, frontmatter: fm, ajustes: montagem });

    // ── A cópia (I10): a identidade foi mandada DAQUI de outro caminho que ainda a tem.
    if (envio.origem === "linha") {
      const outro = this.registro()[envio.sourceUrl];
      if (outro && outro !== caminho) {
        const textoDoOutro = await this.p.notas.lerTexto(outro);
        if (textoDoOutro !== null && daLinha(this.p.ambiente.frontmatter(textoDoOutro)) === envio.sourceUrl) {
          if (!(await this.p.tela.confirmarCopia(outro))) return { tipo: "parou", motivo: "copia-recusada" };
          envio = { ...envio, sourceUrl: novaIdentidade(this.p.ambiente.agora().getTime()), origem: "nova" };
        }
      }
    }
    const primeiro = envio.origem !== "linha";

    // ── O primeiro envio: tema, lista, idioma.
    let escolha: EscolhaDoEnvio = { tema: null, listaId: null, idioma: null };
    if (primeiro) {
      const pasta = pastaDe(caminho);
      const ultima = this.escolhaDaPasta(pasta);
      const padrao: EscolhaDoEnvio = { tema: ultima?.tema ?? null, listaId: ultima?.listaId ?? null, idioma: envio.idioma ?? ultima?.idioma ?? null };
      if (this.ajustes.perguntarAoEnviar) {
        const listas = await this.api().listas();
        const e = await this.p.tela.escolherEnvio({ listas, padrao });
        if (!e) return { tipo: "parou", motivo: "desistiu" };
        escolha = e;
      } else {
        escolha = padrao;
      }
      escolha = {
        tema: escolha.tema && TEMAS.includes(escolha.tema) ? escolha.tema : null,
        listaId: escolha.listaId || null,
        idioma: escolha.idioma && IDIOMAS_DECLARAVEIS.includes(escolha.idioma) ? escolha.idioma : null,
      };
      this.lembrarEscolha(pasta, escolha);

      // ── A linha, antes do envio (I11). Se a nota mudou desde a leitura, nada se escreve nem se manda.
      const id = envio.sourceUrl;
      let mudou = false;
      const ficou = await this.p.notas.processar(caminho, (atual) => {
        if (atual !== lido) {
          mudou = true;
          return atual;
        }
        return escreverLinha(atual, id);
      });
      if (mudou) return this.parou(T().notaMudou, "nota-mudou");
      texto = ficou;
      fm = this.p.ambiente.frontmatter(texto);
      envio = montarEnvio({ caminho, texto, frontmatter: fm, ajustes: montagem });
      if (envio.sourceUrl !== id) throw new Error(`a linha escrita não se relê (${envio.sourceUrl} ≠ ${id})`);
    }

    // ── As figuras, sobre a nota como foi lida (as posições dos embeds são dela); a linha entra depois, igual à do disco.
    const resolucao = resolverFiguras(lido, embeds, (lp) => this.p.ambiente.resolver(lp, caminho));
    const comFiguras = primeiro ? escreverLinha(resolucao.texto, envio.sourceUrl) : resolucao.texto;
    envio = montarEnvio({ caminho, texto, frontmatter: fm, ajustes: montagem, markdownDe: comFiguras });
    const figuras = figurasCitadas(envio.markdown, resolucao.figuras);

    // ── Os tetos, no aparelho, antes de subir.
    const md = cod.encode(envio.markdown);
    if (md.length > TETOS.markdown) return this.parou(T().mdGrande(md.length), "md-grande");
    const total = tamanhoDoZip([{ nome: "nota.md", tamanho: md.length }, ...figuras.map((f) => ({ nome: f.noPacote, tamanho: f.tamanho }))]);
    const soma = md.length + figuras.reduce((n, f) => n + f.tamanho, 0);
    if (total > TETOS.zip || soma > TETOS.descomprimido) return this.parou(T().zipGrande(total), "zip-grande");

    const entradas: EntradaDoZip[] = [{ nome: "nota.md", bytes: md }];
    for (const f of figuras) {
      const b = await this.p.notas.lerBytes(f.caminho);
      if (b === null) {
        resolucao.fora.push({ nome: nomeDoArquivo(f.caminho), motivo: "nao-achada" });
        continue;
      }
      entradas.push({ nome: f.noPacote, bytes: b });
    }
    const zip = criarZip(entradas, { data: DATA_FIXA() });

    // ── O pacote, o S3, o envio.
    this.p.tela.avisar(T().enviando(envio.titulo));
    const api = this.api();
    const { pacoteId, upload } = await api.pedirPacote(zip.length);
    await api.subir(upload, zip);
    const corpo: CorpoDoEnvio = {
      sourceUrl: envio.sourceUrl,
      titulo: envio.titulo,
      vaultPath: envio.vaultPath,
      ...(envio.autor ? { autor: envio.autor } : {}),
      ...(envio.resumo ? { resumo: envio.resumo } : {}),
      ...(envio.publishedAt ? { publishedAt: envio.publishedAt } : {}),
      ...((primeiro ? escolha.idioma : envio.idioma) ? { idioma: (primeiro ? escolha.idioma : envio.idioma)! } : {}),
      // O reenvio não manda tema nem lista (I12): omitir preserva o tema, e a máquina não move o que já está noutro lugar.
      ...(primeiro && escolha.tema ? { tema: escolha.tema } : {}),
      ...(primeiro && escolha.listaId ? { listaId: escolha.listaId } : {}),
    };
    const resultado = await api.publicar(pacoteId, corpo);

    const reg = this.registro();
    reg[envio.sourceUrl] = caminho;
    this.p.local.gravar(this.chaveLocal("registro"), reg);
    this.p.local.gravar(this.chaveLocal("recusas"), 0);
    this.avisarResultado(envio, resultado, resolucao, fm);
    return { tipo: "enviado", resultado, envio, resolucao };
  }

  private avisarResultado(envio: Envio, r: ResultadoDoEnvio, res: Resolucao, fm: Record<string, unknown>) {
    const t = T();
    const partes = [r.acao === "criado" ? t.criado(envio.titulo) : r.acao === "sem-mudanca" ? t.semMudanca(envio.titulo) : t.atualizado(envio.titulo)];
    const l = r.lista;
    if (l) {
      const nome = l.nome ?? l.listaId ?? "";
      if (l.acao === "fora") partes.push(t.foraDaLista(nome, l.lugar ?? "?"));
      else if (l.acao === "ja-estava") partes.push(t.jaNaLista(nome));
      else partes.push(t.naLista(nome));
    }
    if (r.temaIgnorado !== undefined) partes.push(t.temaMantido);
    const fora = res.fora.map((f) =>
      f.motivo === "grande" ? t.figuraGrande(f.nome, f.tamanho ?? 0) : f.motivo === "formato" ? t.figuraFormato(f.nome) : f.motivo === "demais" ? t.figuraDemais(f.nome) : t.figuraNaoAchada(f.nome),
    );
    if (fora.length) partes.push(t.naoForam(fora.join(", ")));
    if (res.notas) partes.push(t.notasEmbutidas(res.notas));
    if (res.anexos) partes.push(t.anexos(res.anexos));
    if (res.desencontrados) partes.push(t.desencontrados(res.desencontrados));
    const faltaram = Array.isArray(r.pacote?.faltaram) ? r.pacote.faltaram.length : 0;
    if (faltaram) partes.push(t.faltaram(faltaram));
    if (envio.avisos.includes("idioma-invalido")) partes.push(t.idiomaInvalido(String(fm.idioma)));
    this.p.tela.avisar(partes.join(" "), { texto: t.abrirNoLeitor, url: `https://lareia.app/a/${encodeURIComponent(r.articleId)}` });
  }

  private tratarFalha(e: unknown): Desfecho {
    if (e instanceof ChaveRecusada) {
      const n = (this.p.local.ler<number>(this.chaveLocal("recusas")) ?? 0) + 1;
      if (n >= RECUSAS_ATE_ESQUECER) {
        this.esquecerEsteAparelho();
        return this.parou(T().avisoDesligado, "desligado");
      }
      this.p.local.gravar(this.chaveLocal("recusas"), n);
      return this.parou(T().chaveRecusada, "chave-recusada");
    }
    if (e instanceof DestinoRecusado) return this.parou(T().uploadForaDoS3(e.host), "destino-recusado");
    if (e instanceof RecusaDaLareia) {
      if (e.slug === "upload-recusado") return this.parou(T().uploadRecusado(e.detalhe), "upload-recusado");
      if (e.slug === "muitos-pacotes") return this.parou(T().muitosPacotes, "muitos-pacotes");
      return this.parou(T().recusouOEnvio(e.detalhe || e.slug || String(e.status)), e.slug ?? `http-${e.status}`);
    }
    if (e instanceof FalhaDeRede) return this.parou(T().falhaNoEnvio(e.message), "rede");
    throw e;
  }
}
