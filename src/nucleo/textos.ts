/**
 * O que o plugin diz à pessoa, em português e em inglês.
 *
 * A língua é a do Obsidian (`getLanguage()`): `pt` e `pt-BR` falam português,
 * e qualquer outra fala inglês — o inglês é o padrão da loja. O `main.ts` a
 * define ao carregar; fora do Obsidian (a suíte, `scripts/fora-do-obsidian.ts`)
 * vale o português, a língua em que o plugin nasceu.
 *
 * O que é RELATÓRIO segue a língua: os avisos, as telas, os comandos. O que é
 * CONTRATO não muda com ela: a linha `lareia-leitor` na nota, o envio, o zip.
 * Um vault sincronizado entre um Mac em português e um iPad em inglês manda os
 * mesmos bytes.
 *
 * As telas seguem o padrão de maiúsculas da loja (só a primeira palavra e os
 * nomes próprios); os rótulos do app Lareia vão como o app os mostra
 * («Conta → Aparelhos → «Ligar ao Obsidian»»), que é o que a pessoa vai procurar.
 */

export type Lingua = "pt" | "en";

/** A língua do plugin para um código de língua do Obsidian. */
export function linguaDe(codigo: string | null | undefined): Lingua {
  return /^pt(?:[-_]|$)/i.test(codigo ?? "") ? "pt" : "en";
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const mib = (bytes: number, virgula: boolean) => {
  const t = (bytes / (1024 * 1024)).toFixed(1);
  return virgula ? t.replace(".", ",") : t;
};

const pt = {
  // ── Os comandos ───────────────────────────────────────────────────────
  cmdEnviar: "Enviar ao Leitor",
  cmdLigar: "Ligar este aparelho (código de pareamento)",
  cmdDesligar: "Desligar este aparelho",
  confirmarDesligar: "Desligar este aparelho? Ele deixa de mandar notas ao Leitor até um novo pareamento. O que já foi mandado fica lá.",
  botaoDesligar: "Desligar",
  cancelar: "Cancelar",

  // ── O pareamento ──────────────────────────────────────────────────────
  pareamentoTitulo: "Ligar este aparelho ao Leitor",
  pareamentoTexto: "No app Lareia, abra Conta → Aparelhos → «Ligar ao Obsidian» e digite aqui o código de 8 caracteres. Ele vale 10 minutos e uma vez só.",
  pareamentoCampo: "Código",
  // A forma do código (8 caracteres em maiúsculas), não uma frase: o padrão de maiúsculas não vale aqui.
  pareamentoExemplo: "ABCD-EFGH",
  pareamentoBotao: "Ligar",

  // ── O primeiro envio ──────────────────────────────────────────────────
  envioTitulo: "Enviar ao Leitor",
  envioTexto: "Onde o texto entra. Isto só se pergunta no primeiro envio: os seguintes atualizam o mesmo texto e não mexem no tema nem na lista.",
  envioTema: "Tema",
  envioLista: "Lista de leitura",
  envioIdioma: "Língua do texto",
  semTema: "Sem tema",
  nenhumaLista: "Nenhuma",
  detectar: "Detectar",
  tema: (slug: string) =>
    ({ literatura: "Literatura", "fe-filosofia": "Fé e Filosofia", "historia-sociedade": "História e Sociedade", "ciencia-tecnologia": "Ciência e Tecnologia", "artes-vida": "Artes e Vida" })[slug] ?? slug,
  lingua: (codigo: string) =>
    ({ "pt-BR": "Português (Brasil)", "en-US": "Inglês (EUA)", "es-ES": "Espanhol (Espanha)", "fr-FR": "Francês (França)", "it-IT": "Italiano", la: "Latim", "de-DE": "Alemão" })[codigo] ?? codigo,
  envioBotao: "Enviar",

  // ── A cópia ───────────────────────────────────────────────────────────
  copiaTitulo: "Esta nota parece uma cópia",
  copiaTexto: (outra: string) => `Esta nota tem a mesma identidade de «${outra}», que este aparelho já mandou e que ainda existe. Mandada assim, ela substituiria aquela no Leitor. Mandar como texto novo?`,
  copiaBotao: "Mandar como texto novo",

  // ── A aba de ajustes ──────────────────────────────────────────────────
  secLigacao: "Ligação",
  ligadoNome: "Este aparelho está ligado ao Leitor",
  ligadoDesc: (segredo: string) => `A chave mora no SecretStorage do Obsidian, sob o nome «${segredo}», e não sincroniza com o vault.`,
  botaoDesligarAparelho: "Desligar este aparelho",
  semLigacaoNome: "Este aparelho não está ligado",
  semLigacaoDesc: "No app Lareia: Conta → Aparelhos → «Ligar ao Obsidian». Usa a rede (a API da Lareia) e pede uma conta Lareia.",
  botaoLigarComCodigo: "Ligar com o código",
  secEnvio: "O envio",
  identidadeNome: "Identidade das notas novas",
  identidadeDesc: "O primeiro envio escreve na nota uma linha lareia-leitor com ela, e é por ela que o reenvio atualiza o mesmo texto. «Nova» é um identificador único; «pelo caminho» é a regra de quem já publicava por script (link, source ou url do front matter, senão o caminho da nota).",
  identidadeNova: "Nova",
  identidadePublicador: "Pelo caminho",
  secoesNome: "Seções que não vão",
  secoesDesc: "Uma por linha: o título de uma seção de nível 2 que fica fora do texto, com tudo até a próxima. Vazio: a nota vai inteira.",
  perguntarNome: "Perguntar no primeiro envio",
  perguntarDesc: "Tema, lista de leitura e língua do texto. Desligado: vale a última escolha feita na mesma pasta, neste aparelho.",
  apiNome: "Endereço da API",
  apiDesc: "Só mude se a Lareia pedir.",

  // ── Os avisos ─────────────────────────────────────────────────────────
  naoLigado: "Lareia: este aparelho ainda não está ligado. No app Lareia, Conta → Aparelhos → «Ligar ao Obsidian»; aqui, o comando «Ligar este aparelho».",
  codigoTorto: "Lareia: o código tem 8 letras e números (por exemplo ABCD-EFGH). Confira e tente de novo.",
  codigoSemForma: "Lareia: o código não tem a forma certa. Gere outro em Conta → Aparelhos → «Ligar ao Obsidian».",
  codigoRecusado: "Lareia: o código foi recusado — ele vale 10 minutos e uma vez só. Gere outro em Conta → Aparelhos.",
  aparelhosDemais: "Lareia: esta conta já tem 10 aparelhos ligados. Desligue um em Conta → Aparelhos e gere outro código.",
  ligou: "Lareia: este aparelho está ligado. Mande a nota aberta com «Enviar ao Leitor».",
  linkSemCodigo: "Lareia: o link não traz o código de pareamento.",
  semFalarComALareia: (erro: string) => `Lareia: não consegui falar com a Lareia (${erro}). Tente de novo.`,
  chaveRecusada: "Lareia: a Lareia recusou a chave deste aparelho agora. Se você o desligou em Conta → Aparelhos, ligue de novo; senão, tente daqui a pouco.",
  avisoDesligado: "Lareia: este aparelho foi desligado. Para voltar a mandar notas, ligue de novo em Conta → Aparelhos → «Ligar ao Obsidian».",
  aparelhoNaoLigado: "Lareia: este aparelho não está ligado.",
  naoDesligou: (erro: string) => `Lareia: não consegui desligar agora (${erro}). Nada mudou; tente de novo, ou revogue em Conta → Aparelhos.`,
  desligou: "Lareia: este aparelho foi desligado. O que já foi mandado fica no Leitor.",
  soMarkdown: "Lareia: só uma nota .md vai ao Leitor.",
  notaNaoExiste: (caminho: string) => `Lareia: não achei a nota ${caminho}.`,
  notaMudou: "Lareia: a nota mudou enquanto eu a preparava. Nada foi mandado; tente de novo.",
  jaEnviando: "Lareia: esta nota já está indo.",
  mdGrande: (bytes: number) => `Lareia: a nota tem ${mib(bytes, true)} MiB, e o teto do Leitor é 4 MiB. Nada foi mandado.`,
  zipGrande: (bytes: number) => `Lareia: a nota com as figuras dá ${mib(bytes, true)} MiB, e o teto do pacote é 32 MiB. Nada foi mandado; tire figuras ou mande em partes.`,
  enviando: (titulo: string) => `Lareia: mandando «${titulo}»…`,
  falhaNoEnvio: (erro: string) => `Lareia: o envio não foi (${erro}). Tente de novo.`,
  muitosPacotes: "Lareia: notas demais nesta hora (o teto é 30 por hora). Tente daqui a pouco.",
  recusouOEnvio: (detalhe: string) => `Lareia: o Leitor recusou o envio — ${detalhe}`,
  uploadRecusado: (codigo: string) => `Lareia: o armazenamento recusou o pacote (${codigo}). Nada foi mandado; tente de novo.`,
  uploadForaDoS3: (host: string) => `Lareia: o endereço de envio não é o armazenamento da Lareia (${host}). Nada foi mandado.`,
  respostaTorta: "a resposta da Lareia veio sem o que eu esperava",

  // ── O resultado ───────────────────────────────────────────────────────
  criado: (titulo: string) => `Lareia: «${titulo}» chegou ao Leitor.`,
  atualizado: (titulo: string) => `Lareia: «${titulo}» foi atualizado no Leitor.`,
  semMudanca: (titulo: string) => `Lareia: «${titulo}» já estava assim no Leitor.`,
  naLista: (nome: string) => `Na lista «${nome}».`,
  jaNaLista: (nome: string) => `Já estava na lista «${nome}».`,
  foraDaLista: (nome: string, lugar: string) => `Não entrou na lista «${nome}»: o texto já está em ${lugar}, e a Lareia não o tira de lá.`,
  temaMantido: "O tema escolhido no app ficou.",
  naoForam: (itens: string) => `Não foram: ${itens}.`,
  figuraGrande: (nome: string, bytes: number) => `«${nome}» (${mib(bytes, true)} MiB, acima do teto)`,
  figuraFormato: (nome: string) => `«${nome}» (formato que o Leitor não lê)`,
  figuraNaoAchada: (nome: string) => `«${nome}» (não achei no vault)`,
  figuraDemais: (nome: string) => `«${nome}» (passou de 450 figuras)`,
  notasEmbutidas: (n: number) => `${n} ${plural(n, "nota embutida", "notas embutidas")} com ![[…]] ${plural(n, "não vai", "não vão")}: o Leitor recebe o texto desta nota, não o das outras.`,
  anexos: (n: number) => `${n} ${plural(n, "anexo", "anexos")} (PDF, áudio, vídeo) ${plural(n, "não vai", "não vão")}.`,
  faltaram: (n: number) => `${n} ${plural(n, "figura não casou", "figuras não casaram")} no Leitor e ${plural(n, "virou", "viraram")} aviso no texto.`,
  desencontrados: (n: number) => `${n} ${plural(n, "embed mudou", "embeds mudaram")} desde que o Obsidian leu a nota e ${plural(n, "foi", "foram")} como ${plural(n, "estava", "estavam")}; mande de novo daqui a pouco.`,
  idiomaInvalido: (valor: string) => `O idioma «${valor}» do front matter não é um dos do Leitor: ele vai detectar.`,
  abrirNoLeitor: "Abrir no Leitor",
};

type Textos = typeof pt;

const en: Textos = {
  cmdEnviar: "Send this note",
  cmdLigar: "Link this device (pairing code)",
  cmdDesligar: "Unlink this device",
  confirmarDesligar: "Unlink this device? It stops sending notes to Lareia until you pair again. What was already sent stays there.",
  botaoDesligar: "Unlink",
  cancelar: "Cancel",

  pareamentoTitulo: "Link this device to Lareia",
  pareamentoTexto: "In the Lareia app, open Conta → Aparelhos → «Ligar ao Obsidian» and type the 8-character code here. It is valid for 10 minutes, once.",
  pareamentoCampo: "Code",
  pareamentoExemplo: "ABCD-EFGH",
  pareamentoBotao: "Link",

  envioTitulo: "Send this note",
  envioTexto: "Where the text goes. This is asked only the first time: later sends update the same text and leave its theme and list alone.",
  envioTema: "Theme",
  envioLista: "Reading list",
  envioIdioma: "Language of the text",
  semTema: "No theme",
  nenhumaLista: "None",
  detectar: "Detect",
  tema: (slug) =>
    ({ literatura: "Literature", "fe-filosofia": "Faith and philosophy", "historia-sociedade": "History and society", "ciencia-tecnologia": "Science and technology", "artes-vida": "Arts and life" })[slug] ?? slug,
  lingua: (codigo) =>
    ({ "pt-BR": "Portuguese (Brazil)", "en-US": "English (US)", "es-ES": "Spanish (Spain)", "fr-FR": "French (France)", "it-IT": "Italian", la: "Latin", "de-DE": "German" })[codigo] ?? codigo,
  envioBotao: "Send",

  copiaTitulo: "This note looks like a copy",
  copiaTexto: (outra) => `This note has the same identity as «${outra}», which this device already sent and which still exists. Sent as it is, it would replace that one in Lareia. Send it as a new text?`,
  copiaBotao: "Send as a new text",

  secLigacao: "Link",
  ligadoNome: "This device is linked to Lareia",
  ligadoDesc: (segredo) => `The key lives in Obsidian's SecretStorage, under the name «${segredo}», and does not sync with the vault.`,
  botaoDesligarAparelho: "Unlink this device",
  semLigacaoNome: "This device is not linked",
  semLigacaoDesc: "In the Lareia app: Conta → Aparelhos → «Ligar ao Obsidian». Uses the network (Lareia's API) and requires a Lareia account.",
  botaoLigarComCodigo: "Link with a code",
  secEnvio: "Sending",
  identidadeNome: "Identity of new notes",
  identidadeDesc: "The first send writes a lareia-leitor line with it into the note, and that line is how a later send updates the same text. «New» is a unique identifier; «by path» is the rule of a script-based publisher (link, source or url from the front matter, otherwise the note's path).",
  identidadeNova: "New",
  identidadePublicador: "By path",
  secoesNome: "Sections left out",
  secoesDesc: "One per line: the title of a level-2 section that stays out of the text, with everything up to the next one. Empty: the whole note goes.",
  perguntarNome: "Ask on the first send",
  perguntarDesc: "Theme, reading list and language of the text. Off: the last choice made in the same folder, on this device, applies.",
  apiNome: "API address",
  apiDesc: "Only change it if Lareia asks you to.",

  naoLigado: "Lareia: this device isn't linked yet. In the Lareia app, Conta → Aparelhos → «Ligar ao Obsidian»; here, the «Link this device» command.",
  codigoTorto: "Lareia: the code has 8 letters and numbers (for example ABCD-EFGH). Check it and try again.",
  codigoSemForma: "Lareia: the code doesn't have the right shape. Generate another in Conta → Aparelhos → «Ligar ao Obsidian».",
  codigoRecusado: "Lareia: the code was refused — it is valid for 10 minutes, once. Generate another in Conta → Aparelhos.",
  aparelhosDemais: "Lareia: this account already has 10 linked devices. Unlink one in Conta → Aparelhos and generate another code.",
  ligou: "Lareia: this device is linked. Send the open note with «Send this note».",
  linkSemCodigo: "Lareia: the link doesn't carry a pairing code.",
  semFalarComALareia: (erro) => `Lareia: couldn't reach Lareia (${erro}). Try again.`,
  chaveRecusada: "Lareia: Lareia refused this device's key just now. If you unlinked it in Conta → Aparelhos, link it again; otherwise, try again in a moment.",
  avisoDesligado: "Lareia: this device was unlinked. To send notes again, link it again in Conta → Aparelhos → «Ligar ao Obsidian».",
  aparelhoNaoLigado: "Lareia: this device isn't linked.",
  naoDesligou: (erro) => `Lareia: couldn't unlink right now (${erro}). Nothing changed; try again, or revoke it in Conta → Aparelhos.`,
  desligou: "Lareia: this device was unlinked. What was already sent stays in Lareia.",
  soMarkdown: "Lareia: only a .md note can be sent.",
  notaNaoExiste: (caminho) => `Lareia: couldn't find the note ${caminho}.`,
  notaMudou: "Lareia: the note changed while I was preparing it. Nothing was sent; try again.",
  jaEnviando: "Lareia: this note is already on its way.",
  mdGrande: (bytes) => `Lareia: the note is ${mib(bytes, false)} MiB, and the limit is 4 MiB. Nothing was sent.`,
  zipGrande: (bytes) => `Lareia: the note with its images comes to ${mib(bytes, false)} MiB, and the package limit is 32 MiB. Nothing was sent; drop some images or send it in parts.`,
  enviando: (titulo) => `Lareia: sending «${titulo}»…`,
  falhaNoEnvio: (erro) => `Lareia: the send didn't go through (${erro}). Try again.`,
  muitosPacotes: "Lareia: too many notes this hour (the limit is 30 per hour). Try again in a while.",
  recusouOEnvio: (detalhe) => `Lareia: Lareia refused the send — ${detalhe}`,
  uploadRecusado: (codigo) => `Lareia: the storage refused the package (${codigo}). Nothing was sent; try again.`,
  uploadForaDoS3: (host) => `Lareia: the upload address isn't Lareia's storage (${host}). Nothing was sent.`,
  respostaTorta: "Lareia's answer came without what I expected",

  criado: (titulo) => `Lareia: «${titulo}» arrived.`,
  atualizado: (titulo) => `Lareia: «${titulo}» was updated.`,
  semMudanca: (titulo) => `Lareia: «${titulo}» was already like this.`,
  naLista: (nome) => `In the list «${nome}».`,
  jaNaLista: (nome) => `Already in the list «${nome}».`,
  foraDaLista: (nome, lugar) => `Not added to the list «${nome}»: the text is already in ${lugar}, and Lareia doesn't move it from there.`,
  temaMantido: "The theme chosen in the app stayed.",
  naoForam: (itens) => `Not sent: ${itens}.`,
  figuraGrande: (nome, bytes) => `«${nome}» (${mib(bytes, false)} MiB, over the limit)`,
  figuraFormato: (nome) => `«${nome}» (a format Lareia doesn't read)`,
  figuraNaoAchada: (nome) => `«${nome}» (not found in the vault)`,
  figuraDemais: (nome) => `«${nome}» (past 450 images)`,
  notasEmbutidas: (n) => `${n} embedded ${plural(n, "note", "notes")} (![[…]]) ${plural(n, "wasn't", "weren't")} sent: Lareia gets this note's text, not the others'.`,
  anexos: (n) => `${n} ${plural(n, "attachment", "attachments")} (PDF, audio, video) ${plural(n, "wasn't", "weren't")} sent.`,
  faltaram: (n) => `${n} ${plural(n, "image", "images")} didn't match in Lareia and became a notice in the text.`,
  desencontrados: (n) => `${n} ${plural(n, "embed", "embeds")} changed since Obsidian last read the note and went as ${plural(n, "it was", "they were")}; send again in a moment.`,
  idiomaInvalido: (valor) => `The language «${valor}» in the front matter isn't one Lareia knows: it will detect it.`,
  abrirNoLeitor: "Open in Lareia",
};

export const TEXTOS: Record<Lingua, Textos> = { pt, en };

let atual: Lingua = "pt";

/** A língua do plugin, pelo código do Obsidian (`getLanguage()`). Devolve a escolhida. */
export function definirLingua(codigo: string | null | undefined): Lingua {
  atual = linguaDe(codigo);
  return atual;
}

export function linguaAtual(): Lingua {
  return atual;
}

/** Os textos na língua atual. Lido na hora de dizer, e não guardado: a língua pode mudar entre um aviso e outro. */
export function T(): Textos {
  return TEXTOS[atual];
}
