/**
 * A identidade da nota no Leitor (spec 96 §4.4): o `sourceUrl` com que ela
 * existe lá. O servidor só sabe dela o que o envio diz; renomear, mover,
 * copiar e sincronizar acontecem do lado de cá. Por isso a identidade mora NA
 * nota, numa linha do front matter que o plugin escreve no primeiro envio:
 *
 *   1. `lareia-leitor`, se for http(s) — a linha;
 *   2. no modo do publicador (os ajustes de quem já publicava por script):
 *      `link`, `source` ou `url` que comece por `http`, senão
 *      `https://vault.local/{caminho slugificado}`;
 *   3. senão, `https://obsidian.local/{ULID novo}`.
 *
 * O passo 2 é a regra de um publicador em Python, linha a linha (o corpus da
 * nota cobra as duas): é o que faz a mesma nota, pelas duas portas, ser o
 * mesmo artigo. A escrita da linha também é a mesma, byte a byte.
 *
 * Sem lookbehind (o iOS anterior ao 16.4 não compila a regex).
 */

export const LINHA = "lareia-leitor";

export type Modo = "nova" | "publicador";
export type Origem = "linha" | "publicador" | "nova";

export const ehHttp = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//.test(v);

/** A verdade de um valor como o Python a vê (`or`): `""`, `[]`, `{}`, `0`, `null` são falsos. */
export function verdadeiro(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object" && !(v instanceof Date)) return Object.keys(v).length > 0;
  return true;
}

/** `slug` do publicador: NFKD, só ASCII, minúsculas, o resto vira hífen. */
export function slug(texto: string): string {
  const t = texto.normalize("NFKD").replace(/[\u0080-\uffff]/g, "");
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** O nome sem a última extensão, como o `Path.stem` do Python. */
export function haste(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i > 0 && i < nome.length - 1 ? nome.slice(0, i) : nome;
}

/** O caminho relativo no vault, sem extensão, slugificado segmento a segmento (`slug_caminho`). */
export function slugCaminho(caminho: string): string {
  const partes = caminho.split("/").filter((p) => p !== "" && p !== ".");
  const nome = partes.pop() ?? "";
  return [...partes, haste(nome)]
    .map(slug)
    .filter(Boolean)
    .join("/");
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Um ULID: 48 bits de milissegundos e 80 de sorte, em Crockford (26 caracteres). */
export function ulid(agora: number = Date.now(), sorte: (n: number) => Uint8Array = aleatorio): string {
  let tempo = "";
  let t = Math.floor(agora);
  for (let i = 0; i < 10; i++) {
    tempo = CROCKFORD[t % 32] + tempo;
    t = Math.floor(t / 32);
  }
  const b = sorte(10);
  let bits = 0;
  let acumulado = 0;
  let resto = "";
  for (const x of b) {
    acumulado = (acumulado << 8) | x;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      resto += CROCKFORD[(acumulado >> bits) & 31];
    }
    acumulado &= (1 << bits) - 1;
  }
  return tempo + resto.slice(0, 16);
}

function aleatorio(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export const novaIdentidade = (agora?: number) => `https://obsidian.local/${ulid(agora)}`;

/** A identidade que a linha da nota já tem, ou `null`. */
export function daLinha(frontmatter: Record<string, unknown>): string | null {
  const v = frontmatter[LINHA];
  return ehHttp(v) ? v : null;
}

/** A identidade da nota pela regra do §4.4, e de qual passo ela veio. */
export function identidade(
  caminho: string,
  frontmatter: Record<string, unknown>,
  modo: Modo,
  nova: () => string = () => novaIdentidade(),
): { sourceUrl: string; origem: Origem } {
  const linha = daLinha(frontmatter);
  if (linha) return { sourceUrl: linha, origem: "linha" };
  if (modo === "publicador") {
    const fm = frontmatter;
    const origem = verdadeiro(fm.link) ? fm.link : verdadeiro(fm.source) ? fm.source : verdadeiro(fm.url) ? fm.url : null;
    // `str(origem).startswith("http")` no Python: só um texto começa por http.
    const sourceUrl = typeof origem === "string" && origem.startsWith("http") ? origem : `https://vault.local/${slugCaminho(caminho)}`;
    return { sourceUrl, origem: "publicador" };
  }
  return { sourceUrl: nova(), origem: "nova" };
}

// ── A linha no front matter ─────────────────────────────────────────────────

/** (início do conteúdo, início da linha que fecha, fim de linha) do bloco `---`, ou `null`. */
function blocoDoFrontMatter(texto: string): { ini: number; fecho: number; nl: string } | null {
  const nl = texto.startsWith("---\r\n") ? "\r\n" : texto.startsWith("---\n") ? "\n" : null;
  if (nl === null) return null;
  const ini = 3 + nl.length;
  let i = ini;
  for (;;) {
    const j = texto.indexOf(nl, i);
    if (texto.slice(i, j >= 0 ? j : texto.length).replace(/[ \t]+$/, "") === "---") return { ini, fecho: i, nl };
    if (j < 0) return null;
    i = j + nl.length;
  }
}

const CHAVE_DA_LINHA = new RegExp(`^${LINHA}[ \\t]*:`);

/**
 * O texto com `lareia-leitor: {identidade}` no front matter, mudando uma linha e
 * só ela (I11): troca a que já existe no primeiro nível, ou entra logo antes do
 * `---` que fecha, ou nasce num bloco novo no topo. O fim de linha é o da nota.
 */
export function escreverLinha(texto: string, id: string): string {
  const linha = `${LINHA}: ${id}`;
  const bloco = blocoDoFrontMatter(texto);
  if (bloco === null) {
    const nl = texto.includes("\r\n") ? "\r\n" : "\n";
    return `---${nl}${linha}${nl}---${nl}${texto}`;
  }
  const { ini, fecho, nl } = bloco;
  let i = ini;
  while (i < fecho) {
    const j = texto.indexOf(nl, i);
    if (CHAVE_DA_LINHA.test(texto.slice(i, j))) return texto.slice(0, i) + linha + texto.slice(j);
    i = j + nl.length;
  }
  return texto.slice(0, fecho) + linha + nl + texto.slice(fecho);
}
