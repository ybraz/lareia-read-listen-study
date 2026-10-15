/**
 * As figuras da nota (spec 96 §4.6, A2): só quem tem o vault resolve
 * `![[foto.png]]`, e esse alguém é o plugin. O servidor apaga todo `![[…]]`,
 * então o plugin põe o arquivo no zip, em `figuras/{n}-{nome}`, e troca o
 * trecho por `![legenda](figuras/…)`. Isso não é limpar sintaxe (I6): é
 * traduzir um endereço do vault para um endereço do pacote.
 *
 * Quem acha os embeds é o Obsidian (`metadataCache`, com a posição de cada um
 * no arquivo e o `getFirstLinkpathDest`), e não uma regex daqui: ele sabe o
 * que está dentro de bloco de código. O núcleo recebe as posições e confere
 * cada uma contra o texto — cache atrasado não troca o trecho errado.
 *
 * Figura que não sobe não derruba o envio (I14): acima do teto, fora do
 * formato (o HEIC do iPhone) ou não achada, ela fica fora do zip e entra no
 * aviso. `![[outra nota]]` e anexos (PDF, áudio, vídeo) não vão (D6), e o
 * aviso diz quantos.
 */

import { haste, slug } from "./identidade.ts";
import { FORMATOS_DE_FIGURA, IMAGENS_FORA_DO_FORMATO, TETOS } from "./tetos.ts";

/** Um embed como o `metadataCache` o dá: o destino, o trecho como está escrito e onde ele está. */
export interface Embed {
  link: string;
  original: string;
  inicio: number;
  fim: number;
}

/** Um arquivo do vault, resolvido pelo Obsidian. */
export interface Arquivo {
  caminho: string;
  nome: string;
  extensao: string;
  tamanho: number;
}

export interface Figura {
  /** No vault. */
  caminho: string;
  /** No zip, e no markdown: `figuras/{n}-{nome}`. */
  noPacote: string;
  tamanho: number;
}

export type Motivo = "grande" | "formato" | "nao-achada" | "demais";

export interface Fora {
  nome: string;
  motivo: Motivo;
  tamanho?: number;
}

export interface Resolucao {
  /** O texto com as figuras resolvidas trocadas. */
  texto: string;
  figuras: Figura[];
  fora: Fora[];
  /** `![[outra nota]]`, `![[nota#seção]]`. */
  notas: number;
  /** PDF, áudio, vídeo e o resto que não é figura. */
  anexos: number;
  /** Embeds cuja posição não confere com o texto (o cache do Obsidian atrasado). */
  desencontrados: number;
}

const extensao = (nome: string) => {
  const h = haste(nome);
  return h === nome ? "" : nome.slice(h.length + 1).toLowerCase();
};

const ehLargura = (s: string) => /^\d+(x\d+)?$/.test(s.trim());

/** A legenda: o apelido de `![[x|legenda]]` ou o alt de `![alt](x)`, sem a largura do Obsidian (`|300`). */
function legendaDe(original: string): string {
  if (original.startsWith("![[")) {
    const dentro = original.slice(3, original.lastIndexOf("]]"));
    const barra = dentro.indexOf("|");
    if (barra < 0) return "";
    const apelido = dentro.slice(barra + 1);
    return ehLargura(apelido) ? "" : apelido.trim();
  }
  const fecho = original.indexOf("](");
  let alt = original.slice(2, fecho < 0 ? 2 : fecho);
  const barra = alt.lastIndexOf("|");
  if (barra >= 0 && ehLargura(alt.slice(barra + 1))) alt = alt.slice(0, barra);
  return alt.trim();
}

const escaparLegenda = (s: string) => s.replace(/([\\[\]])/g, "\\$1");

/** O nome no pacote: só letras, números e hífen — o `casarFigura` do servidor compara o nome decodificado, e nome sem nada a decodificar não tropeça. */
function noPacote(n: number, a: Arquivo): string {
  const base = slug(haste(a.nome)) || "figura";
  return `figuras/${n}-${base}.${extensao(a.nome) || a.extensao.toLowerCase()}`;
}

/**
 * Resolve as figuras de `texto`. `resolver` é o `getFirstLinkpathDest` (o
 * destino do link a partir da nota); devolve `null` quando nada casa.
 */
export function resolverFiguras(texto: string, embeds: Embed[], resolver: (linkpath: string) => Arquivo | null): Resolucao {
  const r: Resolucao = { texto, figuras: [], fora: [], notas: 0, anexos: 0, desencontrados: 0 };
  const porCaminho = new Map<string, Figura>();
  const foraVistos = new Set<string>();
  const trocas: { inicio: number; fim: number; por: string }[] = [];
  const marcarFora = (nome: string, motivo: Motivo, tamanho?: number) => {
    if (foraVistos.has(`${motivo}:${nome}`)) return;
    foraVistos.add(`${motivo}:${nome}`);
    r.fora.push(tamanho === undefined ? { nome, motivo } : { nome, motivo, tamanho });
  };

  for (const e of [...embeds].sort((a, b) => a.inicio - b.inicio)) {
    if (texto.slice(e.inicio, e.fim) !== e.original) {
      r.desencontrados++;
      continue;
    }
    const link = e.link.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue; // http(s), data: — do servidor
    const subcaminho = link.indexOf("#");
    const linkpath = subcaminho >= 0 ? link.slice(0, subcaminho) : link;
    const ext = extensao(linkpath);
    const a = linkpath ? resolver(linkpath) : null;

    if (!a) {
      if (FORMATOS_DE_FIGURA.includes(ext) || IMAGENS_FORA_DO_FORMATO.includes(ext)) marcarFora(linkpath, "nao-achada");
      else if (ext === "" || ext === "md") r.notas++;
      else r.anexos++;
      continue;
    }
    const tipo = (a.extensao || extensao(a.nome)).toLowerCase();
    if (tipo === "md" || tipo === "canvas" || tipo === "base") {
      r.notas++;
      continue;
    }
    if (IMAGENS_FORA_DO_FORMATO.includes(tipo)) {
      marcarFora(a.nome, "formato");
      continue;
    }
    if (!FORMATOS_DE_FIGURA.includes(tipo)) {
      r.anexos++;
      continue;
    }
    if (a.tamanho > (tipo === "svg" ? TETOS.svg : TETOS.figura)) {
      marcarFora(a.nome, "grande", a.tamanho);
      continue;
    }
    let f = porCaminho.get(a.caminho);
    if (!f) {
      if (porCaminho.size >= TETOS.figuras) {
        marcarFora(a.nome, "demais");
        continue;
      }
      f = { caminho: a.caminho, noPacote: noPacote(porCaminho.size + 1, a), tamanho: a.tamanho };
      porCaminho.set(a.caminho, f);
    }
    trocas.push({ inicio: e.inicio, fim: e.fim, por: `![${escaparLegenda(legendaDe(e.original))}](${f.noPacote})` });
  }

  let saida = texto;
  for (const t of trocas.sort((a, b) => b.inicio - a.inicio)) saida = saida.slice(0, t.inicio) + t.por + saida.slice(t.fim);
  r.texto = saida;
  r.figuras = [...porCaminho.values()];
  return r;
}

/** As figuras que o markdown final ainda cita: uma seção podada leva as suas junto. */
export function figurasCitadas(markdown: string, figuras: Figura[]): Figura[] {
  return figuras.filter((f) => markdown.includes(`](${f.noPacote})`));
}
