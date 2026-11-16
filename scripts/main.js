import { MODULE_ID, calcularND, formatarND, ndInteiro, ndParaNumero } from "./calculo.js";

const TESOURO_ID = "t20-gerador-tesouro";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const config = (chave) => game.settings.get(MODULE_ID, chave);

/* -------------------------------------------- */
/*  Leitura dos combatentes                     */
/* -------------------------------------------- */

/** ND de um ator do sistema Tormenta20 (com alguns caminhos alternativos). */
export function ndDoAtor(actor) {
  const s = actor?.system ?? {};
  const bruto = s.attributes?.nd ?? s.detalhes?.nd ?? s.details?.nd ?? s.nd ?? s.attributes?.nd?.value;
  return ndParaNumero(bruto);
}

/** O combatente entra no cálculo? */
function ehAmeaca(combatant) {
  const actor = combatant.actor;
  if (!actor || actor.hasPlayerOwner) return false;
  if (combatant.getFlag?.(MODULE_ID, "ignorar")) return false;
  if (config("considerar") === "naoJogadores") return true;
  const disp = combatant.token?.disposition ?? actor.prototypeToken?.disposition;
  return disp === CONST.TOKEN_DISPOSITIONS.HOSTILE;
}

/** Lista as ameaças de um combate: [{ nd, nome, combatant }] */
export function ameacasDoCombate(combat) {
  return (combat?.combatants ?? [])
    .filter(ehAmeaca)
    .map((c) => ({ nd: ndDoAtor(c.actor), nome: c.name ?? c.actor?.name ?? "", combatant: c }))
    .filter((a) => a.nd != null);
}

/**
 * Calcula o ND do encontro de um combate.
 * @returns {null | ReturnType<calcularND> & { rotulo:string, exato:string, ndTesouro:string }}
 */
export function calcularCombate(combat = game.combat) {
  const r = calcularND(ameacasDoCombate(combat));
  if (!r) return null;
  const modo = config("arredondamento");
  return { ...r, rotulo: ndInteiro(r.nd, modo, false), exato: formatarND(r.nd), ndTesouro: ndInteiro(r.nd, modo) };
}

/* -------------------------------------------- */
/*  Explicação                                  */
/* -------------------------------------------- */

const plural = (n, s, p) => (n === 1 ? s : p);

/** ND arredondado conforme a configuração (sem limite de 20). */
const ndArredondado = (nd) => ndInteiro(nd, config("arredondamento"), false);

function linhaGrupo(g) {
  const qtd = `${g.quantidade}× ND ${formatarND(g.nd)}`;
  const nomes = [...new Set(g.nomes.filter(Boolean))].map(esc).join(", ");
  const ndGrupo = `ND de encontro ${ndArredondado(g.ndGrupo)}`;
  let efeito;
  if (g.base) efeito = "Valor básico";
  else if (!g.bonus) efeito = `${formatarND(g.diferenca)} abaixo do básico — não afeta`;
  else efeito = `Até 1 ponto abaixo do básico: +${formatarND(g.bonus)}`;
  return `<tr class="${g.base ? "base" : !g.bonus ? "ignorado" : ""}">
    <td><strong>${qtd}</strong>${nomes ? `<small>${nomes}</small>` : ""}</td>
    <td>${ndGrupo}<small>${efeito}</small></td>
  </tr>`;
}

function htmlDetalhes(r) {
  const modo = config("arredondamento") === "proximo" ? "arredondado" : "arredondado para baixo";
  const extras = [`${r.total} ${plural(r.total, "ameaça", "ameaças")}`];
  if (r.exato !== r.rotulo) extras.push(`valor exato ${r.exato}, ${modo}`);
  if (r.rotulo !== r.ndTesouro) extras.push(`para tesouro: ND ${r.ndTesouro} (máximo da tabela)`);
  return `<div class="t20nd-detalhes">
    <div class="t20nd-resumo">
      <span>ND do encontro</span>
      <strong>${r.rotulo}</strong>
      <small>${extras.join(" · ")}</small>
    </div>
    <table><tbody>${r.grupos.map(linhaGrupo).join("")}</tbody></table>
  </div>`;
}

/**
 * Quadro compacto com o ND calculado e os grupos, para outras janelas
 * (ex.: tela "Gerar tesouro" do T20 — Gerador de Tesouros).
 */
export function htmlResumo(combat = game.combat) {
  const r = calcularCombate(combat);
  if (!r) return "";
  const itens = r.grupos
    .map((g) => {
      const efeito = g.base ? "valor básico" : g.bonus ? `+${formatarND(g.bonus)}` : "não afeta";
      return `<li class="${g.base ? "base" : !g.bonus ? "ignorado" : ""}">${g.quantidade}× ND ${formatarND(g.nd)} → ND ${ndArredondado(g.ndGrupo)} <em>(${efeito})</em></li>`;
    })
    .join("");
  const exato = r.exato !== r.rotulo ? ` <small>(exato ${r.exato})</small>` : "";
  return `<div class="t20nd-caixa">
    <div class="t20nd-caixa-topo"><i class="fa-solid fa-skull"></i><span>ND do encontro calculado</span><strong>${r.rotulo}</strong>${exato}</div>
    <ul>${itens}</ul>
  </div>`;
}

function tooltipResumo(r) {
  const linhas = r.grupos.map((g) => {
    const qtd = `${g.quantidade}× ND ${formatarND(g.nd)} (ND ${ndArredondado(g.ndGrupo)})`;
    if (g.base) return `${qtd}: valor básico`;
    return g.bonus ? `${qtd}: +${formatarND(g.bonus)}` : `${qtd}: não afeta`;
  });
  return `<strong>ND do encontro: ${r.rotulo}</strong><br>${linhas.map(esc).join("<br>")}`;
}

/** Abre a janela com o detalhamento do cálculo. */
export async function mostrarDetalhes(combat = game.combat) {
  const r = calcularCombate(combat);
  if (!r) return ui.notifications.info("Nenhuma ameaça com ND no combate.");

  const tesouro = game.modules.get(TESOURO_ID);
  const podeTesouro = game.user.isGM && tesouro?.active && tesouro.api?.abrirPrompt;
  const buttons = [{ action: "ok", label: "Fechar", icon: "fa-solid fa-check", default: true }];
  if (podeTesouro) buttons.unshift({ action: "tesouro", label: `Gerar tesouro (ND ${r.ndTesouro})`, icon: "fa-solid fa-gem" });

  const acao = await foundry.applications.api.DialogV2.wait({
    window: { title: "Nível de desafio do encontro", icon: "fa-solid fa-skull" },
    position: { width: 460 },
    content: htmlDetalhes(r),
    rejectClose: false,
    buttons
  });
  if (acao === "tesouro") tesouro.api.abrirPrompt({ ndSugerido: r.ndTesouro, combat });
}

/* -------------------------------------------- */
/*  Rastreador de combate                       */
/* -------------------------------------------- */

function podeVer() {
  return game.user.isGM || config("mostrarJogadores");
}

function desenharFaixa(app, html) {
  if (!config("mostrarNoCombate") || !podeVer()) return;
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  if (!raiz) return;
  raiz.querySelectorAll(".t20nd-faixa").forEach((e) => e.remove());

  const combat = app.viewed ?? game.combat;
  if (!combat) return;
  const r = calcularCombate(combat);

  const faixa = document.createElement("div");
  faixa.className = "t20nd-faixa";
  if (r) {
    faixa.innerHTML = `<i class="fa-solid fa-skull"></i><span>ND do encontro</span><strong>${r.rotulo}</strong>`;
    faixa.dataset.tooltip = tooltipResumo(r);
    faixa.dataset.tooltipDirection = "LEFT";
    faixa.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      mostrarDetalhes(combat);
    });
  } else {
    faixa.classList.add("vazio");
    faixa.innerHTML = `<i class="fa-solid fa-skull"></i><span>Sem ameaças com ND</span>`;
  }

  const cabecalho = raiz.querySelector(".combat-tracker-header") ?? raiz.querySelector("#combat-round") ?? raiz.querySelector("header");
  // Fica entre o cabeçalho e a lista de combatentes (dentro do cabeçalho, que
  // tem altura fixa no v13, ela transbordava sobre os combatentes).
  const lista = raiz.querySelector("ol.combat-tracker, #combat-tracker");
  if (lista) lista.before(faixa);
  else if (cabecalho) cabecalho.after(faixa);
  else raiz.prepend(faixa);
}

const redesenhar = foundry.utils.debounce(() => {
  ui.combat?.render();
  // v13: rastreador destacado (popout) é outra instância.
  const Classe = foundry.applications?.sidebar?.tabs?.CombatTracker;
  if (!Classe) return;
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    if (app instanceof Classe && app !== ui.combat && app.rendered) app.render();
  }
}, 100);

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "mostrarNoCombate", {
    name: "Mostrar no rastreador de combate",
    hint: "Exibe o ND do encontro no topo do rastreador de combate. Clique para ver o cálculo.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => redesenhar()
  });

  game.settings.register(MODULE_ID, "mostrarJogadores", {
    name: "Jogadores também veem o ND",
    hint: "Se desmarcado, apenas o mestre vê o ND do encontro.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => redesenhar()
  });

  game.settings.register(MODULE_ID, "considerar", {
    name: "Quem conta como ameaça",
    hint: "Combatentes controlados por jogadores nunca contam.",
    scope: "world",
    config: true,
    type: String,
    default: "hostis",
    choices: {
      hostis: "Apenas tokens hostis",
      naoJogadores: "Todos os combatentes que não são de jogadores"
    },
    onChange: () => redesenhar()
  });

  game.settings.register(MODULE_ID, "arredondamento", {
    name: "Arredondamento do ND do encontro",
    hint: "Quantidades que não dobram geram ND quebrado (ex.: 3× ND 7 = 10,17). Vale para o ND exibido e para o sugerido ao tesouro.",
    scope: "world",
    config: true,
    type: String,
    default: "baixo",
    choices: { baixo: "Arredondar para baixo", proximo: "Arredondar para o mais próximo" },
    onChange: () => redesenhar()
  });

  game.modules.get(MODULE_ID).api = {
    /** api.calcular(["2", "2", "1/2"]) ou api.calcular([{ nd: 3, nome: "Goblin" }]) */
    calcular: calcularND,
    /** ND do encontro do combate (padrão: o combate ativo). */
    calcularCombate,
    /** ND (string da tabela de tesouro, "1/4" … "20") sugerido para o combate. */
    ndTesouro: (combat = game.combat) => calcularCombate(combat)?.ndTesouro ?? null,
    ameacasDoCombate,
    ndDoAtor,
    formatarND,
    mostrarDetalhes,
    /** HTML com o ND calculado e os grupos (usado pelo gerador de tesouro). */
    htmlResumo
  };
});

Hooks.on("renderCombatTracker", desenharFaixa);

// Mudanças que afetam o cálculo mas nem sempre redesenham o rastreador.
Hooks.on("updateToken", (doc, mudancas) => {
  if ("disposition" in mudancas && game.combat?.combatants.some((c) => c.tokenId === doc.id)) redesenhar();
});
Hooks.on("updateActor", (actor, mudancas) => {
  if (foundry.utils.hasProperty(mudancas, "system") && game.combat?.combatants.some((c) => c.actorId === actor.id)) redesenhar();
});

// Botão no menu de contexto do combatente para ignorar/considerar no cálculo.
function opcoesContexto(app, opcoes) {
  const combatente = (li) => {
    const el = li instanceof HTMLElement ? li : li?.[0];
    const id = el?.dataset?.combatantId;
    return (app.viewed ?? game.combat)?.combatants.get(id);
  };
  opcoes.push(
    {
      name: "Ignorar no ND do encontro",
      icon: '<i class="fa-solid fa-eye-slash"></i>',
      condition: (li) => game.user.isGM && !combatente(li)?.getFlag(MODULE_ID, "ignorar"),
      callback: (li) => combatente(li)?.setFlag(MODULE_ID, "ignorar", true)
    },
    {
      name: "Considerar no ND do encontro",
      icon: '<i class="fa-solid fa-eye"></i>',
      condition: (li) => game.user.isGM && !!combatente(li)?.getFlag(MODULE_ID, "ignorar"),
      callback: (li) => combatente(li)?.unsetFlag(MODULE_ID, "ignorar")
    }
  );
}
Hooks.on("getCombatTrackerEntryContext", opcoesContexto); // v12
Hooks.on("getCombatantContextOptions", opcoesContexto); // v13
