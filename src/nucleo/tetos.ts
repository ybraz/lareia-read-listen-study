/**
 * Os números que o servidor cobra, conferidos aqui antes de subir (spec 96
 * §4.6). São CÓPIAS dos do servidor — o repo público do plugin se constrói
 * sozinho e não importa a ingestão —, e por isso `testes/paridade.test.ts` lê
 * cada um no fonte do servidor e reprova se divergir.
 *
 * Figura fora do teto ou do formato não derruba o envio: fica fora do zip, e o
 * aviso a nomeia (I14). Passar o teto do .md ou do zip recusa o envio no
 * aparelho, com o número.
 */

const MIB = 1024 * 1024;

export const TETOS = Object.freeze({
  /** O .md, em bytes UTF-8 (`LIMITE_CORPO`). */
  markdown: 4 * MIB,
  /** Uma figura (`LIMITES.bytes`). */
  figura: 10 * MIB,
  /** Uma figura SVG (`LIMITES_SVG.bytes`). */
  svg: 2 * MIB,
  /** As figuras distintas de um pacote (`LIMITES.imagens`). */
  figuras: 450,
  /** O zip inteiro (`TETO_PACOTE_TEXTO_BYTES`). */
  zip: 32 * MIB,
  /** A soma descomprimida do que se aceita do zip (`TETO_DESCOMPRIMIDO_BYTES`). */
  descomprimido: 64 * MIB,
});

/** Os formatos que o pacote aceita como figura (`EH_FIGURA` da ingestão). */
export const FORMATOS_DE_FIGURA = Object.freeze(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

/** Formatos de imagem que o pacote NÃO aceita: o aviso diz «formato», não «anexo». */
export const IMAGENS_FORA_DO_FORMATO = Object.freeze(["heic", "heif", "tif", "tiff", "bmp", "avif", "ico", "jxl"]);

/** As línguas do texto que a pessoa escolhe no envio (`LINGUAS_DO_TEXTO`). */
export const LINGUAS_DO_TEXTO = Object.freeze(["pt-BR", "en-US", "es-ES", "fr-FR", "it-IT", "la", "de-DE"]);

/** O que o `idioma` do front matter pode declarar: as línguas e a indeterminada (a mesma lista do publicador). */
export const IDIOMAS_DECLARAVEIS = Object.freeze([...LINGUAS_DO_TEXTO, "und"]);

/** Os cinco temas do Leitor (`TEMAS`), pelo slug. */
export const TEMAS = Object.freeze(["literatura", "fe-filosofia", "historia-sociedade", "ciencia-tecnologia", "artes-vida"]);
