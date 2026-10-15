/**
 * As portas da casca: o que ela pede ao mundo, sem saber se o mundo é o
 * Obsidian (`src/obsidian/`), uma pasta com `fetch` (`scripts/`) ou os dublês
 * dos testes. O pareamento, o envio e o desligar rodam sobre estas interfaces
 * e nada mais.
 *
 * Nenhuma porta enumera o vault (I16): a casca lê a nota que vai, as figuras
 * que ela embute e — na conferência da cópia — UM outro caminho, o que o
 * registro deste aparelho guardou.
 */

import type { Arquivo, Embed } from "../nucleo/figuras.ts";

export type { Arquivo, Embed };

export interface Pedido {
  url: string;
  metodo: "GET" | "POST" | "PUT" | "DELETE";
  cabecalhos?: Record<string, string>;
  /** Texto (JSON) ou bytes (o `multipart/form-data` do POST assinado). */
  corpo?: string | Uint8Array;
}

export interface Resposta {
  status: number;
  texto: string;
}

/** A rede. No Obsidian, `requestUrl` (sem CORS, roda no mobile), com `throw: false`. */
export interface Rede {
  pedir(p: Pedido): Promise<Resposta>;
}

/** O SecretStorage do Obsidian: guarda a chave, e NÃO sincroniza com o vault. */
export interface Cofre {
  ler(nome: string): string | null;
  gravar(nome: string, valor: string): void;
  /** Esquecer o segredo. (O SecretStorage não tem `delete`: grava-se vazio.) */
  esquecer(nome: string): void;
}

/** O que é deste aparelho e não sincroniza (no Obsidian, o `localStorage` do vault). */
export interface Local {
  ler<T>(chave: string): T | null;
  gravar(chave: string, valor: unknown): void;
}

/** As notas, uma a uma, pelo caminho. Não há «listar» de propósito (I16). */
export interface Notas {
  /** O texto da nota, ou `null` se ela não existe. */
  lerTexto(caminho: string): Promise<string | null>;
  /** Lê-modifica-grava atômico (no Obsidian, `app.vault.process`). Devolve o que ficou. */
  processar(caminho: string, fn: (atual: string) => string): Promise<string>;
  /** Os bytes de um arquivo (uma figura), ou `null`. */
  lerBytes(caminho: string): Promise<Uint8Array | null>;
}

/** O resto do Obsidian que o envio consulta. */
export interface Ambiente {
  /** O front matter de um texto, pela YAML do Obsidian. `{}` sem bloco ou com YAML torta. */
  frontmatter(texto: string): Record<string, unknown>;
  /** Os embeds da nota, com a posição de cada um (o `metadataCache`); `null` se o Obsidian ainda não a leu. */
  embeds(caminho: string): Embed[] | null;
  /** O arquivo a que um link aponta, a partir da nota (`getFirstLinkpathDest`). */
  resolver(linkpath: string, deOnde: string): Arquivo | null;
  /** O sistema, da lista fechada do servidor: Mac, Windows, Linux, iPhone, iPad, Android. */
  sistema(): string;
  agora(): Date;
}

export interface EscolhaDoEnvio {
  tema: string | null;
  listaId: string | null;
  /** `null`: o Leitor detecta. */
  idioma: string | null;
}

export interface ListaDeLeitura {
  listaId: string;
  nome: string;
  total?: number;
}

export interface Link {
  texto: string;
  url: string;
}

/** A cara do plugin: os avisos e as perguntas. No Obsidian, `Notice` e `Modal`. */
export interface Tela {
  avisar(mensagem: string, link?: Link): void;
  /** O modal do primeiro envio. `null`: a pessoa desistiu. */
  escolherEnvio(o: { listas: ListaDeLeitura[]; padrao: EscolhaDoEnvio }): Promise<EscolhaDoEnvio | null>;
  /** «Esta nota parece cópia de X. Mandar como texto novo?» */
  confirmarCopia(outra: string): Promise<boolean>;
}

export interface ArmazemDeAjustes {
  carregar(): Promise<unknown>;
  gravar(dados: unknown): Promise<void>;
}
