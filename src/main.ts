/**
 * Lareia Read Listen and Study — o plugin do Obsidian que manda uma nota do
 * vault ao Leitor da Lareia, com as figuras, para ler, ouvir e estudar lá
 * (spec 96). Aqui só se liga o `Controle` ao Obsidian: as portas, as telas,
 * os comandos, os menus e o link `obsidian://`. A decisão mora em `casca/` e em
 * `nucleo/`, que não importam o `obsidian` e rodam fora dele.
 *
 * Só envia: nada volta ao vault além da linha `lareia-leitor` que o primeiro
 * envio escreve na nota.
 */

import { Plugin, TFile, getLanguage } from "obsidian";
import type { Editor, MarkdownFileInfo, MarkdownView, Menu, ObsidianProtocolData, TAbstractFile } from "obsidian";
import { Controle } from "./casca/controle.ts";
import { ID_DO_PLUGIN } from "./casca/ajustes.ts";
import { T, definirLingua } from "./nucleo/textos.ts";
import { AmbienteDoObsidian, ArmazemDoPlugin, CofreDoObsidian, LocalDoObsidian, NotasDoObsidian, RedeDoObsidian } from "./obsidian/adaptadores.ts";
import { AbaDeAjustes, ModalDeConfirmacao, ModalDePareamento, TelaDoObsidian } from "./obsidian/telas.ts";

const ehNota = (f: TAbstractFile | null | undefined): f is TFile => f instanceof TFile && f.extension === "md";

export default class LareiaReadListenStudy extends Plugin {
  controle!: Controle;

  async onload() {
    // A língua do Obsidian, antes de qualquer texto: os nomes dos comandos se
    // registram uma vez, e um aviso dito antes sairia na língua errada.
    definirLingua(getLanguage());
    this.controle = new Controle({
      notas: new NotasDoObsidian(this.app),
      rede: new RedeDoObsidian(),
      cofre: new CofreDoObsidian(this.app),
      local: new LocalDoObsidian(this.app),
      ambiente: new AmbienteDoObsidian(this.app),
      tela: new TelaDoObsidian(this.app),
      armazem: new ArmazemDoPlugin(this),
    });
    await this.controle.carregar();

    this.addSettingTab(new AbaDeAjustes(this.app, this));

    this.addCommand({
      id: "enviar",
      name: T().cmdEnviar,
      checkCallback: (checando: boolean) => {
        const f = this.app.workspace.getActiveFile();
        if (!ehNota(f)) return false;
        if (!checando) void this.controle.enviar(f.path);
        return true;
      },
    });
    this.addCommand({ id: "ligar", name: T().cmdLigar, callback: () => this.abrirPareamento() });
    this.addCommand({ id: "desligar", name: T().cmdDesligar, callback: () => this.confirmarDesligar() });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, f: TAbstractFile) => {
        if (!ehNota(f)) return;
        menu.addItem((item) =>
          item
            .setTitle(T().cmdEnviar)
            .setIcon("send")
            .onClick(() => void this.controle.enviar(f.path)),
        );
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, _editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
        const f = info.file;
        if (!ehNota(f)) return;
        menu.addItem((item) =>
          item
            .setTitle(T().cmdEnviar)
            .setIcon("send")
            .onClick(() => void this.controle.enviar(f.path)),
        );
      }),
    );

    // `obsidian://lareia-read-listen-study?codigo=…`: o mesmo pareamento do
    // modal. O código vale 10 minutos e uma vez, e pode viajar no link; não se
    // grava em lugar nenhum.
    this.registerObsidianProtocolHandler(ID_DO_PLUGIN, (params: ObsidianProtocolData) => this.controle.aoAbrirLink(params));
  }

  abrirPareamento() {
    new ModalDePareamento(this.app, (codigo) => this.controle.parear(codigo)).open();
  }

  confirmarDesligar() {
    new ModalDeConfirmacao(this.app, { texto: T().confirmarDesligar, botao: T().botaoDesligar, aviso: true }, (sim) => {
      if (sim) void this.controle.desligar();
    }).open();
  }
}
