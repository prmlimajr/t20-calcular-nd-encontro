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
 * @returns {null | ReturnType<calcularND> & { rotulo:string, ndTesouro:string }}
 */
export function calcularCombate(combat = game.combat) {
  const r = calcularND(ameacasDoCombate(combat), { regra: config("regra") });
  if (!r) return null;
  return { ...r, rotulo: formatarND(r.nd), ndTesouro: ndInteiro(r.nd, config("arredondamento")) };
}

/* -------------------------------------------- */
/*  Explicação                                  */
/* -------------------------------------------- */

const plural = (n, s, p) => (n === 1 ? s : p);

function linhaGrupo(g) {
  const qtd = `${g.quantidade}× ND ${formatarND(g.nd)}`;
  const nomes = [...new Set(g.nomes.filter(Boolean))].map(esc).join(", ");
  const ndGrupo = `ND de encontro ${formatarND(g.ndGrupo)}`;
  let efeito;
  if (g.base) efeito = "Valor básico";
  else if (!g.bonus) efeito = `${formatarND(g.diferenca)} abaixo do básico — não afeta`;
  else efeito = `${g.diferenca <= 1 + 1e-9 ? "até 1" : g.diferenca <= 2 + 1e-9 ? "até 2" : "até 3"} abaixo do básico: +${formatarND(g.bonus)}`;
  return `<tr class="${g.base ? "base" : !g.bonus ? "ignorado" : ""}">
    <td><strong>${qtd}</strong>${nomes ? `<small>${nomes}</small>` : ""}</td>
    <td>${ndGrupo}<small>${efeito}</small></td>
  </tr>`;
}

function htmlDetalhes(r) {
  const tesouro = config("arredondamento") === "proximo" ? "arredondado" : "arredondado para baixo";
  return `<div class="t20nd-detalhes">
    <div class="t20nd-resumo">
      <span>ND do encontro</span>
      <strong>${r.rotulo}</strong>
      <small>${r.total} ${plural(r.total, "ameaça", "ameaças")}${
        r.rotulo !== r.ndTesouro ? ` · para tesouro: ND ${r.ndTesouro} (${tesouro})` : ""
      }</small>
    </div>
    <table><tbody>${r.grupos.map(linhaGrupo).join("")}</tbody></table>
  </div>`;
}

function tooltipResumo(r) {
  const linhas = r.grupos.map((g) => {
    const qtd = `${g.quantidade}× ND ${formatarND(g.nd)} (ND ${formatarND(g.ndGrupo)})`;
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
  if (acao === "tesouro") tesouro.api.abrirPrompt({ ndSugerido: r.ndTesouro, origem: MODULE_ID });
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
  if (cabecalho) cabecalho.append(faixa);
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

  game.settings.register(MODULE_ID, "regra", {
    name: "Regra para ameaças de ND diferentes",
    hint:
      "Desafios compostos: cada grupo até 1 ponto abaixo do valor básico soma +1; grupos 2 ou mais abaixo não afetam. " +
      "Fracionada (opcional): grupos até 2 abaixo somam +1/2 e até 3 abaixo somam +1/4.",
    scope: "world",
    config: true,
    type: String,
    default: "livro",
    choices: { livro: "Desafios compostos (livro)", fracionada: "Fracionada (+1/2 e +1/4)" },
    onChange: () => redesenhar()
  });

  game.settings.register(MODULE_ID, "arredondamento", {
    name: "ND sugerido para tesouro",
    hint: "O ND do encontro pode ser fracionário (ex.: 5¾). Como transformá-lo num ND da tabela de tesouro.",
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
    mostrarDetalhes
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
