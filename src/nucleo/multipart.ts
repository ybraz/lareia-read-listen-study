/**
 * O corpo do POST assinado do S3, em `multipart/form-data`, montado à mão
 * (spec 96 §4.6): o `requestUrl` do Obsidian não conhece `FormData`, e o corpo
 * vai como `ArrayBuffer`. Os campos da assinatura primeiro, na ordem em que o
 * servidor os deu, e o arquivo por ÚLTIMO, com o nome `file` — o S3 ignora o
 * que vem depois dele.
 */

const cod = new TextEncoder();

export interface Formulario {
  corpo: Uint8Array;
  tipo: string;
}

/** Um nome de campo ou de arquivo não pode trazer aspas nem quebra de linha: o cabeçalho da parte se partiria. */
function conferir(s: string, oQue: string) {
  if (/["\r\n]/.test(s)) throw new Error(`multipart: ${oQue} com aspas ou quebra de linha: ${JSON.stringify(s).slice(0, 60)}`);
}

export function montarFormulario(
  campos: Record<string, string>,
  arquivo: { nome: string; tipo: string; bytes: Uint8Array },
  fronteira: string,
): Formulario {
  if (!/^[0-9A-Za-z'()+_,.-]{1,70}$/.test(fronteira)) throw new Error("multipart: fronteira inválida");
  const partes: Uint8Array[] = [];
  for (const [k, v] of Object.entries(campos)) {
    conferir(k, "campo");
    partes.push(cod.encode(`--${fronteira}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  conferir(arquivo.nome, "arquivo");
  partes.push(
    cod.encode(`--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.tipo}\r\n\r\n`),
    arquivo.bytes,
    cod.encode(`\r\n--${fronteira}--\r\n`),
  );
  const total = partes.reduce((n, p) => n + p.length, 0);
  const corpo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    corpo.set(p, pos);
    pos += p.length;
  }
  return { corpo, tipo: `multipart/form-data; boundary=${fronteira}` };
}

/** Uma fronteira que não aparece nos bytes do arquivo (o zip é método 0: o texto da nota está lá dentro, cru). */
export function fronteiraPara(bytes: Uint8Array, sorte: () => string): string {
  for (;;) {
    const f = `----lareia${sorte()}`;
    if (!contem(bytes, cod.encode(f))) return f;
  }
}

function contem(h: Uint8Array, a: Uint8Array): boolean {
  for (let i = h.indexOf(a[0]); i >= 0 && i + a.length <= h.length; i = h.indexOf(a[0], i + 1)) {
    let j = 1;
    while (j < a.length && h[i + j] === a[j]) j++;
    if (j === a.length) return true;
  }
  return false;
}
