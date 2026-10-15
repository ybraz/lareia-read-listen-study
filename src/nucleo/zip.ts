/**
 * O zip da casa, o quarto escritor (spec 96 §4.6, I13). O formato é fixo até o
 * último campo, porque um leitor só o abre (o do servidor): método 0, o bit 11
 * em toda entrada (nome em UTF-8), sem ZIP64, sem entrada de diretório, sem
 * extra, sem comentário, e a data é parâmetro, lida pelos getters LOCAIS (o
 * DOS não tem fuso). A mesma lista de entradas com a mesma data sai com os
 * MESMOS bytes daqui e dos outros escritores da Lareia — o teste compara.
 *
 * Sem Node e sem DOM: roda no iPad.
 */

export const ZIP_TETOS = { entradas: 65534, bytes: 0xffffffff };

/** A data fixa dos geradores determinísticos: 1980-01-01 00:00, hora local. */
export const DATA_FIXA = () => new Date(1980, 0, 1, 0, 0, 0);

export interface EntradaDoZip {
  nome: string;
  bytes: Uint8Array;
}

let tabela: Uint32Array | null = null;

/** CRC-32 da tabela IEEE (polinômio refletido 0xEDB88320). */
export function crc32(bytes: Uint8Array): number {
  if (!tabela) {
    tabela = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = tabela[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const ehBytes = (b: unknown): b is Uint8Array => Object.prototype.toString.call(b) === "[object Uint8Array]";
const ehData = (d: unknown): d is Date => Object.prototype.toString.call(d) === "[object Date]" && !Number.isNaN((d as Date).getTime());

const codificador = new TextEncoder();

/** Sem `/` inicial, sem `\`, sem segmento vazio, `.` ou `..`, sem entrada de diretório: o leitor ignoraria cada um em silêncio. */
function conferirNome(nome: unknown): asserts nome is string {
  if (typeof nome !== "string" || !nome) throw new Error("zip: entrada sem nome");
  if (nome.startsWith("/")) throw new Error(`zip: nome com / inicial: ${nome}`);
  if (nome.includes("\\")) throw new Error(`zip: nome com \\: ${nome}`);
  if (nome.endsWith("/")) throw new Error(`zip: entrada de diretório não existe neste formato: ${nome}`);
  if (nome.split("/").some((s) => s === "" || s === "." || s === "..")) {
    throw new Error(`zip: nome com segmento vazio, . ou ..: ${nome}`);
  }
}

function dos(data: unknown): { hora: number; dia: number } {
  if (!ehData(data)) throw new Error("zip: data precisa ser um Date válido");
  const ano = data.getFullYear();
  if (ano < 1980) throw new Error(`zip: o DOS não tem data antes de 1980 (${ano})`);
  if (ano > 2107) throw new Error(`zip: o DOS não tem data depois de 2107 (${ano})`);
  return {
    hora: (data.getHours() << 11) | (data.getMinutes() << 5) | (data.getSeconds() >> 1),
    dia: ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate(),
  };
}

/** O tamanho que `criarZip` daria a estas entradas, sem alocar nada (o teto se confere antes). */
export function tamanhoDoZip(entradas: { nome: string; tamanho: number }[]): number {
  let total = 22;
  for (const e of entradas) total += 30 + 46 + 2 * codificador.encode(e.nome).length + e.tamanho;
  return total;
}

export function criarZip(entradas: EntradaDoZip[], opcoes: { data: Date }): Uint8Array {
  if (!Array.isArray(entradas)) throw new Error("zip: entradas precisa ser uma lista");
  if (entradas.length > ZIP_TETOS.entradas) {
    throw new Error(`zip: ${entradas.length} entradas — sem ZIP64, o teto é ${ZIP_TETOS.entradas}`);
  }
  const { hora, dia } = dos(opcoes?.data);

  const vistos = new Set<string>();
  const preparadas = entradas.map((e) => {
    conferirNome(e?.nome);
    if (typeof (e.bytes as unknown) === "string") throw new Error(`zip: ${e.nome} veio como string — codifique em UTF-8 antes`);
    if (!ehBytes(e.bytes)) throw new Error(`zip: ${e.nome} precisa de bytes em Uint8Array`);
    if (vistos.has(e.nome)) throw new Error(`zip: nome repetido: ${e.nome}`);
    vistos.add(e.nome);
    const nome = codificador.encode(e.nome);
    if (nome.length > 0xffff) throw new Error(`zip: nome longo demais: ${e.nome.slice(0, 40)}…`);
    return { nome, bytes: e.bytes };
  });
  let total = 22;
  for (const p of preparadas) total += 30 + 46 + 2 * p.nome.length + p.bytes.length;
  if (total > ZIP_TETOS.bytes) throw new Error(`zip: ${total} bytes — sem ZIP64, o teto é ${ZIP_TETOS.bytes}`);

  const saida = new Uint8Array(total);
  const vista = new DataView(saida.buffer);
  let pos = 0;
  const u16 = (v: number) => {
    vista.setUint16(pos, v, true);
    pos += 2;
  };
  const u32 = (v: number) => {
    vista.setUint32(pos, v >>> 0, true);
    pos += 4;
  };
  const pedaco = (b: Uint8Array) => {
    saida.set(b, pos);
    pos += b.length;
  };

  const centrais: { nome: Uint8Array; bytes: Uint8Array; crc: number; deslocamento: number }[] = [];
  for (const p of preparadas) {
    const crc = crc32(p.bytes);
    centrais.push({ ...p, crc, deslocamento: pos });
    u32(0x04034b50); // cabeçalho local
    u16(20); // versão necessária
    u16(0x0800); // bit 11: nome em UTF-8
    u16(0); // método 0
    u16(hora);
    u16(dia);
    u32(crc);
    u32(p.bytes.length); // comprimido = tamanho
    u32(p.bytes.length);
    u16(p.nome.length);
    u16(0); // extra 0
    pedaco(p.nome);
    pedaco(p.bytes);
  }

  const inicioCentral = pos;
  for (const c of centrais) {
    u32(0x02014b50); // diretório central
    u16(20);
    u16(20); // feito por 20, necessária 20
    u16(0x0800);
    u16(0);
    u16(hora);
    u16(dia);
    u32(c.crc);
    u32(c.bytes.length);
    u32(c.bytes.length);
    u16(c.nome.length);
    u16(0);
    u16(0); // extra 0, comentário 0
    u16(0); // disco 0
    u16(0);
    u32(0); // atributos interno e externo
    u32(c.deslocamento);
    pedaco(c.nome);
  }
  const tamanhoCentral = pos - inicioCentral;

  u32(0x06054b50); // fim do diretório central
  u16(0);
  u16(0); // discos
  u16(centrais.length);
  u16(centrais.length);
  u32(tamanhoCentral);
  u32(inicioCentral);
  u16(0); // comentário 0
  return saida;
}
