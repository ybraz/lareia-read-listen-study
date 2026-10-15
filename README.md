# Lareia Read Listen and Study

*[English below](#english)*

O plugin do Obsidian que manda uma nota do seu vault para o app Lareia, com as imagens, para ler, ouvir e estudar lá. Roda no Obsidian do Mac, do Windows, do Linux, do iPad, do iPhone e do Android. A interface fala português ou inglês, conforme a língua do Obsidian.

## O que ele faz

- **Enviar ao Leitor**, pelo comando, pelo menu do arquivo ou pelo menu do editor, manda a nota aberta: o texto, o título e o autor do front matter (`title`, `author` ou `autor`), o resumo (`description`, ou o primeiro parágrafo), a data (`date`) e as imagens que ela embute.
- **No primeiro envio**, uma janela pergunta o tema, a lista de leitura (das listas da sua conta) e a língua do texto. Ela lembra, neste aparelho, a última escolha de cada pasta.
- **Reenviar atualiza o mesmo texto** em vez de criar outro, com os destaques dos parágrafos que não mudaram. O reenvio não pergunta nada e não mexe no tema nem na lista que você escolheu no app.
- **Apagou o texto no Lareia?** Reenviar o traz de volta enquanto ele estiver na lixeira (30 dias).
- O aviso do fim diz o que aconteceu (chegou, atualizado, sem mudança, em que lista) e o que não foi, com o link **Abrir no Leitor**.

## O que vai e o que não vai

| Na nota | O que acontece |
|---|---|
| `![[foto.png]]`, `![[foto.png\|300]]`, `![[foto.png\|legenda]]`, `![](anexos/foto.png)` | a imagem vai junto, pelos bytes (png, jpg, gif, webp, svg) |
| imagem por `https://` | o Lareia a busca |
| imagem acima de 10 MiB (svg acima de 2 MiB), HEIC e outros formatos | não vai, e o aviso a nomeia; o resto do envio segue |
| `![[outra nota]]`, PDF, áudio, vídeo | não vai, e o aviso diz quantos |
| wikilinks, callouts, `%%comentários%%`, `==destaques==`, blocos `^id` | vão como estão; quem os entende é o Lareia |

A nota tem de caber em 4 MiB, e a nota com as imagens, em 32 MiB. Acima disso, o plugin recusa no aparelho, antes de mandar. Os ajustes deixam escolher seções `##` que ficam de fora (por padrão, a nota vai inteira).

## A linha `lareia-leitor`

No primeiro envio, o plugin escreve **uma linha** no front matter da nota (e cria o bloco `---` se ela não tinha um):

    lareia-leitor: https://obsidian.local/…

É a identidade da nota no Lareia, e é por ela que o reenvio atualiza o mesmo texto: ela vai com a nota quando você a renomeia ou move, no Obsidian, no Finder ou pela sincronização do vault, e vale de qualquer aparelho seu. O resto da nota não muda. **Apagar a linha desliga a nota do texto**: o envio seguinte cria outro, e o antigo fica no Lareia.

Duplicar uma nota leva a linha junto. Se a cópia for mandada daqui enquanto a original ainda existe com a mesma linha, o plugin pergunta antes se é para mandar como texto novo.

## Rede e conta

O plugin **usa a rede**: fala só com a API do Lareia (`execute-api.sa-east-1.amazonaws.com`), para ligar o aparelho, ler os nomes das suas listas de leitura e mandar a nota, e com o endereço de envio assinado do armazenamento do Lareia (S3 da AWS), por onde sobe o pacote da nota com as imagens. **Exige uma conta Lareia.** Não chama IA, não tem telemetria e é grátis; vale o limite de envios da sua conta.

O plugin não percorre o vault: lê a nota que você manda e as imagens que ela embute, e mais nada.

## Como ligar

1. No app Lareia: **Conta → Aparelhos → «Ligar ao Obsidian»**. Aparece um código de 8 caracteres, válido por 10 minutos e uma vez só.
2. No Obsidian: comando **Ligar este aparelho (código de pareamento)**, ou o botão nos ajustes do plugin, e digite o código. No mesmo aparelho, o link «Abrir no Obsidian», ao lado do código no Lareia, faz isso por você.

Cada instalação do Obsidian liga por si: o Mac e o iPad do mesmo vault pareiam cada um, e a mesma nota mandada dos dois é o mesmo texto.

Para desligar: comando **Desligar este aparelho**, ou revogue em Conta → Aparelhos no app Lareia — o envio seguinte para e avisa que o aparelho foi desligado.

## Onde guarda o quê

| O quê | Onde | Sincroniza com o vault? |
|---|---|---|
| A chave do aparelho | **SecretStorage do Obsidian**, sob `lareia-leitor-{id do vault}` | não |
| Os ajustes (identidade das notas novas, seções que ficam de fora, perguntar no primeiro envio) | `data.json` na pasta do plugin | sim — e **nunca** com a chave nem o código |
| A identidade de cada nota | a linha `lareia-leitor` no front matter da própria nota | sim |
| A última escolha por pasta e as notas mandadas daqui | o armazenamento local do Obsidian, deste aparelho | não |

## Comandos

- **Enviar ao Leitor**
- **Ligar este aparelho (código de pareamento)**
- **Desligar este aparelho**

## Para quem desenvolve

```sh
npm ci
npm run build   # tsc + esbuild → main.js
```

O núcleo (`src/nucleo/`) é TypeScript puro, sem Obsidian e sem Node: monta o envio, resolve as imagens e faz o zip. A casca (`src/casca/`) liga o núcleo à nota e à API sem importar o `obsidian`; `src/obsidian/` são os adaptadores e as telas.

O Lareia não é afiliado ao Obsidian.

---

## English

The Obsidian plugin that sends a note from your vault to the Lareia app, with its images, to read, listen to and study there. Works on desktop (macOS, Windows, Linux) and mobile (iPad, iPhone, Android). The interface speaks English or Portuguese, following Obsidian's language.

### What it does

- **Send this note**, from the command palette, the file menu or the editor menu, sends the open note: its text, the title and author from the front matter (`title`, `author` or `autor`), the summary (`description`, or the first paragraph), the date (`date`) and the images it embeds.
- **On the first send**, a dialog asks for the theme, the reading list (from your account's lists) and the language of the text. On this device, it remembers the last choice for each folder.
- **Sending again updates the same text** instead of creating another one, keeping the highlights of paragraphs that didn't change. A later send asks nothing and leaves the theme and list you chose in the app alone.
- **Deleted the text in Lareia?** Sending again brings it back while it's in the trash (30 days).
- The final notice says what happened (arrived, updated, unchanged, which list) and what wasn't sent, with an **Open in Lareia** link.

### What goes and what doesn't

| In the note | What happens |
|---|---|
| `![[photo.png]]`, `![[photo.png\|300]]`, `![[photo.png\|caption]]`, `![](attachments/photo.png)` | the image goes along, as bytes (png, jpg, gif, webp, svg) |
| an `https://` image | Lareia fetches it |
| an image over 10 MiB (svg over 2 MiB), HEIC and other formats | not sent, and the notice names it; the rest still goes |
| `![[another note]]`, PDF, audio, video | not sent, and the notice says how many |
| wikilinks, callouts, `%%comments%%`, `==highlights==`, `^id` blocks | sent as they are; Lareia understands them |

The note must fit in 4 MiB, and the note with its images in 32 MiB. Over that, the plugin refuses on the device, before sending. The settings let you pick `##` sections to leave out (by default, the whole note goes).

### The `lareia-leitor` line

On the first send, the plugin writes **one line** into the note's front matter (creating the `---` block if the note had none):

    lareia-leitor: https://obsidian.local/…

It is the note's identity in Lareia, and it's how a later send updates the same text: it travels with the note when you rename or move it, in Obsidian, in Finder or through your vault sync, and works from any of your devices. The rest of the note doesn't change. **Deleting the line unlinks the note from the text**: the next send creates a new one, and the old one stays in Lareia.

Duplicating a note copies the line too. If the copy is sent from here while the original still exists with the same line, the plugin first asks whether to send it as a new text.

### Network and account

This plugin **uses the network**: it talks only to Lareia's API (`execute-api.sa-east-1.amazonaws.com`), to link the device, read the names of your reading lists and send the note, and to the signed upload address of Lareia's storage (AWS S3), where the note's package with its images is uploaded. **A Lareia account is required.** No AI calls, no telemetry; free, within your account's sending limits.

The plugin doesn't walk your vault: it reads the note you send and the images it embeds, and nothing else.

### Pairing

1. In the Lareia app, go to **Conta → Aparelhos → «Ligar ao Obsidian»** to get an 8-character code (valid for 10 minutes, single use).
2. In Obsidian, run **Link this device (pairing code)** or use the button in the plugin settings, and type it. On the same device, the «Open in Obsidian» link next to the code in Lareia does it for you.

Each Obsidian install links on its own: the Mac and the iPad of the same vault pair separately, and the same note sent from both is the same text.

To unlink: run **Unlink this device**, or revoke it in Conta → Aparelhos in the Lareia app — the next send stops and says the device was unlinked.

### What is stored where

| What | Where | Syncs with the vault? |
|---|---|---|
| The device key | **Obsidian's SecretStorage**, under `lareia-leitor-{vault id}` | no |
| Settings (identity of new notes, sections left out, ask on the first send) | `data.json` in the plugin folder | yes — and **never** with the key or the code |
| Each note's identity | the `lareia-leitor` line in the note's own front matter | yes |
| The last choice per folder and the notes sent from here | Obsidian's local storage, on this device | no |

### Commands

- **Send this note**
- **Link this device (pairing code)**
- **Unlink this device**

### Development

```sh
npm ci
npm run build   # tsc + esbuild → main.js
```

The core (`src/nucleo/`) is plain TypeScript, with no Obsidian and no Node: it assembles the send, resolves the images and builds the zip. The shell (`src/casca/`) connects the core to the note and the API without importing `obsidian`; `src/obsidian/` holds the adapters and the screens.

Lareia is not affiliated with Obsidian.
