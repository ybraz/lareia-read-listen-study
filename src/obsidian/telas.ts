/**
 * As telas do plugin: o pareamento, o primeiro envio, a cópia, a confirmação
 * de desligar e a aba de ajustes. Só o que se vê; a decisão é toda do `Controle`.
 */

import { Modal, Notice, PluginSettingTab, Setting, type App } from "obsidian";
import type { Plugin } from "obsidian";
import type { Controle } from "../casca/controle.ts";
import type { EscolhaDoEnvio, Link, ListaDeLeitura, Tela } from "../casca/portas.ts";
import { LINGUAS_DO_TEXTO, TEMAS } from "../nucleo/tetos.ts";
import { T } from "../nucleo/textos.ts";

/** O código de pareamento. Ele não se guarda em lugar nenhum: o campo some com o modal. */
export class ModalDePareamento extends Modal {
  private aoLigar: (codigo: string) => Promise<unknown>;
  constructor(app: App, aoLigar: (codigo: string) => Promise<unknown>) {
    super(app);
    this.aoLigar = aoLigar;
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle(T().pareamentoTitulo);
    contentEl.createEl("p", { text: T().pareamentoTexto });
    let codigo = "";
    new Setting(contentEl).setName(T().pareamentoCampo).addText((t) =>
      t.setPlaceholder(T().pareamentoExemplo).onChange((v) => {
        codigo = v;
      }),
    );
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText(T().pareamentoBotao)
        .setCta()
        .onClick(async () => {
          this.close();
          await this.aoLigar(codigo);
        }),
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** O primeiro envio: tema, lista e idioma. «Cancelar» (ou fechar) não manda nada e não escreve a linha. */
export class ModalDoEnvio extends Modal {
  private listas: ListaDeLeitura[];
  private escolha: EscolhaDoEnvio;
  private resolver: (e: EscolhaDoEnvio | null) => void;
  private enviar = false;

  constructor(app: App, listas: ListaDeLeitura[], padrao: EscolhaDoEnvio, resolver: (e: EscolhaDoEnvio | null) => void) {
    super(app);
    this.listas = listas;
    this.escolha = { ...padrao };
    this.resolver = resolver;
  }

  onOpen() {
    const { contentEl } = this;
    const t = T();
    this.setTitle(t.envioTitulo);
    contentEl.createEl("p", { text: t.envioTexto });
    new Setting(contentEl).setName(t.envioTema).addDropdown((d) => {
      d.addOption("", t.semTema);
      for (const s of TEMAS) d.addOption(s, t.tema(s));
      d.setValue(this.escolha.tema ?? "").onChange((v) => {
        this.escolha.tema = v || null;
      });
    });
    new Setting(contentEl).setName(t.envioLista).addDropdown((d) => {
      d.addOption("", t.nenhumaLista);
      for (const l of this.listas) d.addOption(l.listaId, l.nome);
      const valida = this.listas.some((l) => l.listaId === this.escolha.listaId);
      d.setValue(valida ? this.escolha.listaId! : "").onChange((v) => {
        this.escolha.listaId = v || null;
      });
      if (!valida) this.escolha.listaId = null;
    });
    new Setting(contentEl).setName(t.envioIdioma).addDropdown((d) => {
      d.addOption("", t.detectar);
      for (const c of LINGUAS_DO_TEXTO) d.addOption(c, t.lingua(c));
      d.setValue(this.escolha.idioma && LINGUAS_DO_TEXTO.includes(this.escolha.idioma) ? this.escolha.idioma : "").onChange((v) => {
        this.escolha.idioma = v || null;
      });
    });
    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText(t.envioBotao)
          .setCta()
          .onClick(() => {
            this.enviar = true;
            this.close();
          }),
      )
      .addButton((b) => b.setButtonText(t.cancelar).onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
    this.resolver(this.enviar ? this.escolha : null);
  }
}

export class ModalDeConfirmacao extends Modal {
  private titulo: string;
  private texto: string;
  private botao: string;
  private aviso: boolean;
  private resolver: (sim: boolean) => void;
  private sim = false;
  constructor(app: App, o: { titulo?: string; texto: string; botao: string; aviso?: boolean }, resolver: (sim: boolean) => void) {
    super(app);
    this.titulo = o.titulo ?? "";
    this.texto = o.texto;
    this.botao = o.botao;
    this.aviso = o.aviso ?? false;
    this.resolver = resolver;
  }
  onOpen() {
    if (this.titulo) this.setTitle(this.titulo);
    this.contentEl.createEl("p", { text: this.texto });
    new Setting(this.contentEl)
      .addButton((b) => {
        b.setButtonText(this.botao).onClick(() => {
          this.sim = true;
          this.close();
        });
        if (this.aviso) b.setWarning();
        else b.setCta();
      })
      .addButton((b) => b.setButtonText(T().cancelar).onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
    this.resolver(this.sim);
  }
}

export class TelaDoObsidian implements Tela {
  private app: App;
  constructor(app: App) {
    this.app = app;
  }
  avisar(mensagem: string, link?: Link) {
    if (!link) {
      new Notice(mensagem, 8000);
      return;
    }
    const f = createFragment((el) => {
      el.createSpan({ text: mensagem + " " });
      el.createEl("a", { text: link.texto, href: link.url });
    });
    new Notice(f, 12000);
  }
  escolherEnvio(o: { listas: ListaDeLeitura[]; padrao: EscolhaDoEnvio }): Promise<EscolhaDoEnvio | null> {
    return new Promise((resolver) => new ModalDoEnvio(this.app, o.listas, o.padrao, resolver).open());
  }
  confirmarCopia(outra: string): Promise<boolean> {
    return new Promise((resolver) => new ModalDeConfirmacao(this.app, { titulo: T().copiaTitulo, texto: T().copiaTexto(outra), botao: T().copiaBotao }, resolver).open());
  }
}

const linhas = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export interface PluginComControle extends Plugin {
  controle: Controle;
  abrirPareamento(): void;
  confirmarDesligar(): void;
}

/**
 * Todos os campos do `data.json`, menos o segredo — que aqui só aparece pelo nome.
 *
 * Sem `getSettingDefinitions()`: a API declarativa só existe nos tipos a partir
 * do 1.13, e o plugin pede 1.11.4 (o SecretStorage).
 */
export class AbaDeAjustes extends PluginSettingTab {
  private plugin: PluginComControle;
  constructor(app: App, plugin: PluginComControle) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const c = this.plugin.controle;
    const a = c.ajustes;
    const t = T();
    const salvar = async () => {
      await c.salvar();
    };
    containerEl.empty();

    new Setting(containerEl).setName(t.secLigacao).setHeading();
    const ligacao = new Setting(containerEl);
    if (c.estado().tipo === "ligado") {
      ligacao
        .setName(t.ligadoNome)
        .setDesc(t.ligadoDesc(a.nomeDoSegredo))
        .addButton((b) => b.setButtonText(t.botaoDesligarAparelho).setWarning().onClick(() => this.plugin.confirmarDesligar()));
    } else {
      ligacao
        .setName(t.semLigacaoNome)
        .setDesc(t.semLigacaoDesc)
        .addButton((b) => b.setButtonText(t.botaoLigarComCodigo).setCta().onClick(() => this.plugin.abrirPareamento()));
    }

    new Setting(containerEl).setName(t.secEnvio).setHeading();
    new Setting(containerEl)
      .setName(t.identidadeNome)
      .setDesc(t.identidadeDesc)
      .addDropdown((d) =>
        d
          .addOption("nova", t.identidadeNova)
          .addOption("publicador", t.identidadePublicador)
          .setValue(a.identidade)
          .onChange(async (v) => {
            a.identidade = v === "publicador" ? "publicador" : "nova";
            await salvar();
          }),
      );
    new Setting(containerEl)
      .setName(t.secoesNome)
      .setDesc(t.secoesDesc)
      .addTextArea((x) =>
        x.setValue(a.secoesQueNaoVao.join("\n")).onChange(async (v) => {
          a.secoesQueNaoVao = linhas(v);
          await salvar();
        }),
      );
    new Setting(containerEl)
      .setName(t.perguntarNome)
      .setDesc(t.perguntarDesc)
      .addToggle((x) =>
        x.setValue(a.perguntarAoEnviar).onChange(async (v) => {
          a.perguntarAoEnviar = v;
          await salvar();
        }),
      );
    new Setting(containerEl)
      .setName(t.apiNome)
      .setDesc(t.apiDesc)
      .addText((x) =>
        x.setValue(a.api).onChange(async (v) => {
          a.api = v.trim();
          await salvar();
        }),
      );
  }
}
