/**
 * A montagem do envio (spec 96 §4.6 e §4.10): o que acompanha a nota —
 * identidade, título, autor, resumo, data, idioma — e o markdown que vai no
 * pacote. É lógica de cliente com duas implementações, esta e a do publicador
 * em Python, e um corpus só (`docs/corpus-da-nota/`), que as duas suítes rodam
 * (I7). Caso novo entra no corpus, não numa suíte só.
 *
 * O que NÃO se faz aqui é limpar a sintaxe do Obsidian (I6): wikilink,
 * callout, `%%comentário%%`, `==destaque==`, embed de nota e front matter são
 * entendidos pelo parser do servidor, o mesmo para todas as portas. A nota vai
 * como ela é, menos as seções podadas pelos ajustes e com o fim de linha em LF
 * (o publicador lê assim). As referências de figura que o plugin resolveu
 * são trocadas em `figuras.ts`, não aqui.
 *
 * O front matter chega já lido pela YAML do Obsidian (`frontmatter`); o
 * publicador tem o seu parser mínimo, e onde os dois discordam o corpus mostra.
 */

import { identidade, verdadeiro, haste, type Modo, type Origem } from "./identidade.ts";
import { IDIOMAS_DECLARAVEIS } from "./tetos.ts";

export interface AjustesDaMontagem {
  modo: Modo;
  /** As seções `## {nome}` que não vão (com o que vem até o próximo `## `). */
  secoes: string[];
}

export interface Envio {
  sourceUrl: string;
  origem: Origem;
  vaultPath: string;
  titulo: string;
  autor: string | null;
  resumo: string | null;
  publishedAt: string | null;
  idioma: string | null;
  markdown: string;
  /** O que a montagem deixou de fora e a pessoa precisa saber (`idioma-invalido`). */
  avisos: string[];
}

/** O fim de linha como o `read_text` do Python o entrega: `\r\n` e `\r` viram `\n`. */
export const emLf = (texto: string) => texto.replace(/\r\n?/g, "\n");

/**
 * (cabeça, corpo) pela fronteira do publicador: o bloco abre com `---\n` e
 * fecha no primeiro `\n---` depois dele; as linhas em branco depois do fecho
 * vão com a cabeça. Sem bloco, a cabeça é vazia e o corpo é o texto.
 */
export function separar(texto: string): { cabeca: string; corpo: string } {
  if (!texto.startsWith("---\n")) return { cabeca: "", corpo: texto };
  const fim = texto.indexOf("\n---", 4);
  if (fim === -1) return { cabeca: "", corpo: texto };
  const corpo = texto.slice(fim + 4).replace(/^\n+/, "");
  return { cabeca: texto.slice(0, texto.length - corpo.length), corpo };
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** O `strip()` do Python. */
const aparar = (s: string) => s.trim();

/** O bloco de destaques que o Leitor escreve de volta na nota (a mesma regex do servidor, em `markdown.mjs`). */
const BLOCO_DE_DESTAQUES = /\n?<!-- leitor:destaques[^>]*-->[\s\S]*?<!-- \/leitor -->[ \t]*\n?/g;
// A marca do bloco escondido, em área de uso privado: o lint da loja recusa caractere de controle na regex.
const ABRE = String.fromCharCode(0xe000);
const FECHA = String.fromCharCode(0xe001);
const MARCA = new RegExp(`${ABRE}\\d+${FECHA}`, "g");

/**
 * O corpo sem as seções dos ajustes, aparado (`podar` do publicador, sem a poda do bloco do Leitor:
 * essa é do servidor). A seção podada NÃO atravessa o bloco (spec 96 §4.6, I6): ele se esconde antes
 * do corte — senão o `(?=\n## )` parava no `## Destaques` de dentro dele e comia a abertura, e o
 * servidor recebia o fechamento sem par — e volta inteiro, mesmo de dentro de uma seção podada.
 */
export function podar(corpo: string, secoes: string[]): string {
  const nomes = secoes.map((s) => s.trim()).filter(Boolean);
  if (!nomes.length) return aparar(corpo);
  const blocos: string[] = [];
  const escondido = corpo.replace(BLOCO_DE_DESTAQUES, (b) => `${ABRE}${blocos.push(b) - 1}${FECHA}`);
  // `\n##\s+(…)\b.*?(?=\n## |\Z)` com re.S|re.I: o `$` sem a flag `m` é o fim do texto.
  const re = new RegExp(`\\n##\\s+(?:${nomes.map(escapar).join("|")})\\b[\\s\\S]*?(?=\\n## |$)`, "gi");
  const podado = escondido.replace(re, (secao) => (secao.match(MARCA) ?? []).join(""));
  return aparar(podado.replace(MARCA, (m) => blocos[Number(m.slice(1, -1))]));
}

/** As linhas como o `splitlines()` do Python as corta. */
// Os separadores de grupo, registro e unidade (0x1c–0x1e) também quebram linha no Python; a
// regex os recebe montados, porque o lint da loja recusa caractere de controle escrito na regex.
const QUEBRAS = new RegExp(`\\r\\n|[\\n\\r\\v\\f${String.fromCharCode(0x1c, 0x1d, 0x1e)}\\x85\\u2028\\u2029]`);
const linhas = (t: string) => t.split(QUEBRAS);

const cp = (s: string) => Array.from(s);

/** O primeiro parágrafo de prosa limpa (`extrair_resumo`), com até 280 caracteres. */
export function extrairResumo(texto: string): string | null {
  if (!texto) return null;
  for (const bruto of texto.split("\n\n")) {
    const p = bruto.trim();
    if (!p || /^(#|>|\||```|~~~|- |\* |\d+\. |<!--)/.test(p)) continue;
    let limpo = p.replace(/\*\*([^*]+)\*\*/g, "$1");
    limpo = limpo.replace(/\*([^*]+)\*/g, "$1");
    limpo = limpo.replace(/_([^_]+)_/g, "$1");
    limpo = limpo.replace(/`([^`]+)`/g, "$1");
    limpo = limpo.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
    limpo = limpo.replace(/\[\[([^\]]+)\]\]/g, "$1");
    limpo = limpo.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    limpo = limpo.replace(/\s+/g, " ").trim();
    const c = cp(limpo);
    if (c.length >= 20) {
      if (c.length <= 280) return limpo;
      const trunc = c.slice(0, 277);
      const ponto = ultimo(trunc, ". ");
      if (ponto > 100) return trunc.slice(0, ponto + 1).join("");
      const espaco = trunc.lastIndexOf(" ");
      return (espaco > 100 ? trunc.slice(0, espaco) : trunc).join("") + "…";
    }
  }
  return null;
}

/** O `rfind` de um par de caracteres numa lista de pontos de código. */
function ultimo(c: string[], par: string): number {
  for (let i = c.length - 2; i >= 0; i--) if (c[i] === par[0] && c[i + 1] === par[1]) return i;
  return -1;
}

/** Um valor do front matter como texto, se ele for verdadeiro; o resto (lista, objeto) não vale. */
function textoDe(v: unknown): string | null {
  if (!verdadeiro(v)) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** `date` no formato ISO (AAAA-MM-DD), como texto; a YAML pode tê-la lido como `Date`. */
function dataDe(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : null;
  }
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * O envio de uma nota. `markdownDe` é o texto de onde sai o markdown (a nota
 * com as figuras já trocadas); título e resumo saem SEMPRE da nota como ela
 * é, para valerem o mesmo que no publicador, que não troca figura.
 */
export function montarEnvio(o: {
  caminho: string;
  texto: string;
  frontmatter: Record<string, unknown>;
  ajustes: AjustesDaMontagem;
  markdownDe?: string;
  nova?: () => string;
}): Envio {
  const fm = o.frontmatter ?? {};
  const texto = emLf(o.texto);
  const { cabeca, corpo: corpoCru } = separar(texto);
  const corpo = podar(corpoCru, o.ajustes.secoes);

  const nome = o.caminho.slice(o.caminho.lastIndexOf("/") + 1);
  const cabecalho = linhas(corpo).find((l) => l.startsWith("# "));
  const titulo = textoDe(fm.title) ?? (cabecalho !== undefined ? cabecalho.slice(2).trim() : haste(nome));

  const autor = textoDe(fm.author) ?? textoDe(fm.autor);
  const resumoInteiro = textoDe(fm.description) ?? extrairResumo(corpo);
  const resumo = resumoInteiro ? cp(resumoInteiro).slice(0, 280).join("") : null;

  const avisos: string[] = [];
  let idioma: string | null = null;
  const declarado = textoDe(fm.idioma);
  if (declarado !== null) {
    if (IDIOMAS_DECLARAVEIS.includes(declarado)) idioma = declarado;
    else avisos.push("idioma-invalido");
  }

  let markdown = cabeca + corpo;
  if (o.markdownDe !== undefined) {
    const outro = separar(emLf(o.markdownDe));
    markdown = outro.cabeca + podar(outro.corpo, o.ajustes.secoes);
  }

  const { sourceUrl, origem } = identidade(o.caminho, fm, o.ajustes.modo, o.nova);
  return {
    sourceUrl,
    origem,
    vaultPath: o.caminho,
    titulo,
    autor,
    resumo,
    publishedAt: dataDe(fm.date),
    idioma,
    markdown,
    avisos,
  };
}
