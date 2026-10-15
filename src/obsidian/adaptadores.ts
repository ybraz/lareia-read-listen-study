/**
 * As portas da casca, implementadas sobre a API do Obsidian. Só a API pública
 * (`obsidian.d.ts` da 1.11.4, o `minAppVersion`), e nada de Node: roda no iPad.
 *
 * A nota se lê pelo caminho e se grava por `app.vault.process`
 * (ler-modificar-gravar atômico dentro do Obsidian). Nada aqui lista o vault
 * (I16): não há `getFiles`, `getMarkdownFiles` nem `adapter.list` — só a nota
 * que vai, as figuras que ela embute (pelo `metadataCache`) e o caminho que o
 * registro guardou. Nada aqui apaga arquivo.
 */

import { Platform, TFile, getFrontMatterInfo, parseYaml, requestUrl, type App } from "obsidian";
import type { Ambiente, ArmazemDeAjustes, Arquivo, Cofre, Embed, Local, Notas, Pedido, Rede, Resposta } from "../casca/portas.ts";
import { ID_DO_PLUGIN } from "../casca/ajustes.ts";

export class NotasDoObsidian implements Notas {
  private app: App;
  constructor(app: App) {
    this.app = app;
  }
  async lerTexto(c: string): Promise<string | null> {
    const f = this.app.vault.getFileByPath(c);
    return f ? this.app.vault.read(f) : null;
  }
  async processar(c: string, fn: (atual: string) => string): Promise<string> {
    const f = this.app.vault.getFileByPath(c);
    if (!f) throw new Error(`não existe: ${c}`);
    return this.app.vault.process(f, fn);
  }
  async lerBytes(c: string): Promise<Uint8Array | null> {
    const f = this.app.vault.getFileByPath(c);
    return f ? new Uint8Array(await this.app.vault.readBinary(f)) : null;
  }
}

export class RedeDoObsidian implements Rede {
  async pedir(p: Pedido): Promise<Resposta> {
    // `requestUrl`: sem CORS, e o mesmo no desktop e no mobile. Bytes vão como `ArrayBuffer`.
    const corpo =
      p.corpo === undefined || typeof p.corpo === "string" ? p.corpo : (p.corpo.buffer.slice(p.corpo.byteOffset, p.corpo.byteOffset + p.corpo.byteLength) as ArrayBuffer);
    const r = await requestUrl({ url: p.url, method: p.metodo, headers: p.cabecalhos, body: corpo, throw: false });
    let texto = "";
    try {
      texto = r.text;
    } catch {
      texto = "";
    }
    return { status: r.status, texto };
  }
}

/**
 * O SecretStorage (≥ 1.11.4): `app.secretStorage.setSecret / getSecret`. Ele
 * não sincroniza com o vault — é por isso que a chave mora aqui e o `data.json`
 * guarda só o nome. Não há `deleteSecret` na API: esquecer é gravar vazio, e
 * vazio conta como ausente.
 */
export class CofreDoObsidian implements Cofre {
  private app: App;
  constructor(app: App) {
    this.app = app;
  }
  ler(n: string): string | null {
    return this.app.secretStorage.getSecret(n) || null;
  }
  gravar(n: string, v: string): void {
    this.app.secretStorage.setSecret(n, v);
  }
  esquecer(n: string): void {
    this.app.secretStorage.setSecret(n, "");
  }
}

/** O `localStorage` do vault: o que é deste aparelho (o registro das identidades, a última escolha por pasta). */
export class LocalDoObsidian implements Local {
  private app: App;
  constructor(app: App) {
    this.app = app;
  }
  ler<T>(c: string): T | null {
    return (this.app.loadLocalStorage(`${ID_DO_PLUGIN}:${c}`) as T) ?? null;
  }
  gravar(c: string, v: unknown): void {
    this.app.saveLocalStorage(`${ID_DO_PLUGIN}:${c}`, v ?? null);
  }
}

export class AmbienteDoObsidian implements Ambiente {
  private app: App;
  constructor(app: App) {
    this.app = app;
  }
  frontmatter(texto: string): Record<string, unknown> {
    // A YAML do Obsidian sobre o texto lido AGORA, e não o `metadataCache`: logo
    // depois de escrever a linha, o cache ainda não a viu.
    const info = getFrontMatterInfo(texto);
    if (!info.exists) return {};
    try {
      const v: unknown = parseYaml(info.frontmatter);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  embeds(c: string): Embed[] | null {
    const f = this.app.vault.getFileByPath(c);
    const cache = f ? this.app.metadataCache.getFileCache(f) : null;
    if (!cache) return null;
    return (cache.embeds ?? []).map((e) => ({ link: e.link, original: e.original, inicio: e.position.start.offset, fim: e.position.end.offset }));
  }
  resolver(linkpath: string, deOnde: string): Arquivo | null {
    const f = this.app.metadataCache.getFirstLinkpathDest(linkpath, deOnde);
    return f instanceof TFile ? { caminho: f.path, nome: f.name, extensao: f.extension, tamanho: f.stat.size } : null;
  }
  sistema(): string {
    if (Platform.isIosApp) return Platform.isTablet ? "iPad" : "iPhone";
    if (Platform.isAndroidApp) return "Android";
    if (Platform.isMacOS) return "Mac";
    if (Platform.isWin) return "Windows";
    return "Linux";
  }
  agora() {
    return new Date();
  }
}

export class ArmazemDoPlugin implements ArmazemDeAjustes {
  private plugin: { loadData(): Promise<unknown>; saveData(d: unknown): Promise<void> };
  constructor(plugin: { loadData(): Promise<unknown>; saveData(d: unknown): Promise<void> }) {
    this.plugin = plugin;
  }
  carregar() {
    return this.plugin.loadData();
  }
  gravar(d: unknown) {
    return this.plugin.saveData(d);
  }
}
