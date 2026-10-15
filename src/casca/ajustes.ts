/**
 * Os ajustes do plugin — o `data.json` na pasta do plugin.
 *
 * O `data.json` SINCRONIZA com o vault (iCloud, Obsidian Sync, Git), e por
 * isso ele NUNCA guarda a chave nem o código de pareamento (I5) — só o NOME do
 * segredo, que mora no SecretStorage do Obsidian, que não sincroniza. O nome
 * leva o app (`lareia-leitor-{id}`): outro plugin da Lareia no mesmo vault
 * guarda a chave dele em `lareia-{id}`, e o mesmo nome sobrescreveria a outra
 * chave. `normalizar` só deixa passar os campos daqui: um campo estranho posto
 * à mão no arquivo não volta a ser gravado.
 */

import type { Modo } from "../nucleo/identidade.ts";

export const ID_DO_PLUGIN = "lareia-read-listen-study";
export const API_PADRAO = "https://u2sq0ozzg1.execute-api.sa-east-1.amazonaws.com/v1";

/** O prefixo do nome do segredo. Nunca `lareia-` sozinho. */
export const PREFIXO_DO_SEGREDO = "lareia-leitor-";

export interface Ajustes {
  api: string;
  /** Aleatório, nasce na instalação. Entra no nome do segredo: no mobile o SecretStorage é compartilhado entre vaults. */
  idDoVault: string;
  /** `lareia-leitor-{idDoVault}` — o NOME do segredo, nunca o segredo. */
  nomeDoSegredo: string;
  /** A identidade das notas novas (§4.4): `nova` (ULID) ou `publicador` (pelo caminho). */
  identidade: Modo;
  /** As seções `## ` que não vão. */
  secoesQueNaoVao: string[];
  /** O modal do primeiro envio. */
  perguntarAoEnviar: boolean;
}

export function novoIdDoVault(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const nomeDoSegredo = (idDoVault: string) => `${PREFIXO_DO_SEGREDO}${idDoVault}`;

export function padrao(idDoVault = novoIdDoVault()): Ajustes {
  return {
    api: API_PADRAO,
    idDoVault,
    nomeDoSegredo: nomeDoSegredo(idDoVault),
    identidade: "nova",
    secoesQueNaoVao: [],
    perguntarAoEnviar: true,
  };
}

const ID_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** O `data.json` como ele está no disco → os ajustes, só com os campos conhecidos. */
export function normalizar(bruto: unknown): { ajustes: Ajustes; mudou: boolean } {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const id = typeof b.idDoVault === "string" && ID_VALIDO.test(b.idDoVault) ? b.idDoVault : novoIdDoVault();
  const p = padrao(id);
  const secoes = Array.isArray(b.secoesQueNaoVao) && b.secoesQueNaoVao.every((x) => typeof x === "string") ? b.secoesQueNaoVao.map((x: string) => x.trim()).filter(Boolean) : p.secoesQueNaoVao;
  const ajustes: Ajustes = {
    api: (typeof b.api === "string" && b.api.trim()) || p.api,
    idDoVault: id,
    // O nome se deriva do id, sempre: um nome editado à mão apontaria para o segredo de outro vault, ou de outro plugin.
    nomeDoSegredo: nomeDoSegredo(id),
    identidade: b.identidade === "publicador" ? "publicador" : "nova",
    secoesQueNaoVao: secoes,
    perguntarAoEnviar: typeof b.perguntarAoEnviar === "boolean" ? b.perguntarAoEnviar : p.perguntarAoEnviar,
  };
  const mudou =
    JSON.stringify(Object.keys(b).sort()) !== JSON.stringify(Object.keys(ajustes).sort()) || b.idDoVault !== id || b.nomeDoSegredo !== ajustes.nomeDoSegredo;
  return { ajustes, mudou };
}
