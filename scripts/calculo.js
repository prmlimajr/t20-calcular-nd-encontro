/**
 * Cálculo do ND de um encontro com várias ameaças (Tormenta20).
 *
 * "Vários inimigos" (Tormenta20, p. 282):
 *  - ND ≥ 1: +2 no ND cada vez que a quantidade dobra (2× ND 1 = ND 3; 4× ND 5 = ND 9).
 *  - ND < 1: ND × quantidade (4× ND 1/4 = ND 1; 2× ND 1/2 = ND 1).
 *
 * "Desafios compostos" (ameaças de ND diferentes):
 *  1) forme grupos com todas as ameaças de mesmo ND;
 *  2) calcule o ND de encontro de cada grupo (regra acima);
 *  3) o grupo de maior ND de encontro é o valor básico;
 *  4) cada outro grupo até 1 ponto abaixo do valor básico soma +1;
 *     grupos 2 ou mais pontos abaixo não afetam o encontro.
 *
 * ND fracionário usa uma escala "efetiva": ND ≥ 1 fica igual; ND < 1 vira
 * 1 + 2·log2(ND) (1/2 → -1, 1/4 → -3). Nela, dobrar a quantidade sempre soma +2,
 * o que reproduz exatamente a regra "ND × quantidade".
 */

export const MODULE_ID = "t20-calcular-nd-encontro";

/** "1/4" → 0.25, "5" → 5, "S" → 20, "S+" → 21. Retorna null se não for um ND. */
export function ndParaNumero(nd) {
  if (typeof nd === "number") return Number.isFinite(nd) && nd > 0 ? nd : null;
  const s = String(nd ?? "").trim().toUpperCase().replace(",", ".");
  if (!s) return null;
  if (s === "S+") return 21;
  if (s === "S") return 20;
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const paraEfetivo = (nd) => (nd >= 1 ? nd : 1 + 2 * Math.log2(nd));
export const deEfetivo = (e) => (e >= 1 ? e : 2 ** ((e - 1) / 2));

const EPS = 1e-9;

/** Quanto um grupo soma ao encontro, dada a diferença para o valor básico. */
export const bonusPorDiferenca = (diferenca) => (diferenca <= 1 + EPS ? 1 : 0);

/**
 * Calcula o ND do encontro.
 * @param {Array<number|string|{nd:number|string, nome?:string}>} ameacas
 * @returns {null | {
 *   nd: number,          // ND real do encontro (pode ser fracionário)
 *   efetivo: number,
 *   basico: number,      // valor básico (ND de encontro do grupo mais forte)
 *   grupos: Array<{nd:number, quantidade:number, ndGrupo:number, diferenca:number, bonus:number, base:boolean, nomes:string[]}>,
 *   total: number
 * }}
 */
export function calcularND(ameacas) {
  const lista = (ameacas ?? [])
    .map((a) => (a && typeof a === "object" ? { nd: ndParaNumero(a.nd), nome: a.nome ?? "" } : { nd: ndParaNumero(a), nome: "" }))
    .filter((a) => a.nd != null);
  if (!lista.length) return null;

  // 1) Grupos por ND individual.
  const mapa = new Map();
  for (const a of lista) {
    if (!mapa.has(a.nd)) mapa.set(a.nd, []);
    mapa.get(a.nd).push(a.nome);
  }

  // 2) ND de encontro de cada grupo.
  const grupos = [...mapa.entries()]
    .map(([nd, nomes]) => {
      const ef = paraEfetivo(nd) + 2 * Math.log2(nomes.length);
      return { nd, quantidade: nomes.length, nomes, ef, ndGrupo: deEfetivo(ef) };
    })
    .sort((a, b) => b.ef - a.ef || b.nd - a.nd);

  // 3) Valor básico.
  const [topo, ...resto] = grupos;
  let efetivo = topo.ef;
  Object.assign(topo, { base: true, diferenca: 0, bonus: 0 });

  // 4) Demais grupos.
  for (const g of resto) {
    g.base = false;
    g.diferenca = topo.ef - g.ef;
    g.bonus = bonusPorDiferenca(g.diferenca);
    efetivo += g.bonus;
  }

  return { nd: deEfetivo(efetivo), efetivo, basico: topo.ndGrupo, grupos, total: lista.length };
}

/* -------------------------------------------- */
/*  Formatação                                  */
/* -------------------------------------------- */

const FRACOES = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 0.25 → "1/4", 5 → "5", 5.75 → "5¾", 4.17 → "4,17". */
export function formatarND(nd) {
  if (nd == null || !Number.isFinite(nd)) return "—";
  if (nd < 1) {
    for (const [v, r] of [[1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 2, "1/2"], [3 / 4, "3/4"]]) if (Math.abs(nd - v) < 0.01) return r;
    return nd.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  const inteiro = Math.floor(nd + EPS);
  const resto = Math.round((nd - inteiro) * 100) / 100;
  if (resto === 0) return String(inteiro);
  if (FRACOES[resto]) return `${inteiro}${FRACOES[resto]}`;
  return nd.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

const ORDEM_TESOURO = ["1/4", "1/2", ...Array.from({ length: 20 }, (_, i) => String(i + 1))];

/**
 * Arredonda o ND real do encontro para um ND inteiro (ou 1/4, 1/2).
 * @param {number} nd
 * @param {"baixo"|"proximo"} modo  arredondar para baixo ou para o mais próximo
 * @param {boolean} limitar        limita a 20 (tabela de tesouro)
 */
export function ndInteiro(nd, modo = "baixo", limitar = true) {
  if (nd == null || !Number.isFinite(nd)) return null;
  if (nd < 1) {
    // Frações: arredonda na escala efetiva (1/4 → 1/2 → 1 a cada dobro).
    const e = paraEfetivo(nd);
    const r = modo === "proximo" ? Math.round(e + EPS) : Math.floor(e + EPS);
    if (r >= 1) return "1";
    return r >= -1 ? "1/2" : "1/4";
  }
  const n = modo === "proximo" ? Math.round(nd + EPS) : Math.floor(nd + EPS);
  return String(Math.max(1, limitar ? Math.min(20, n) : n));
}

export const ndsDaTabela = () => [...ORDEM_TESOURO];
