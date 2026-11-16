# T20 — ND do Encontro

Módulo para Foundry VTT (v12/v13) e o sistema **Tormenta20** que calcula o nível de desafio (ND) de um encontro com várias ameaças.

## Regras

**Vários inimigos** (*Tormenta20*, p. 282)
- ND 1 ou maior: +2 no ND cada vez que a quantidade dobra (2× ND 1 = ND 3; 4× ND 5 = ND 9).
- ND menor que 1: ND × quantidade (4× ND 1/4 = ND 1).

**Desafios compostos** (ameaças de ND diferentes)
1. Forme grupos com todas as ameaças de mesmo ND.
2. Calcule o ND de encontro de cada grupo (regra acima).
3. O grupo de maior ND de encontro é o **valor básico**.
4. Cada outro grupo até 1 ponto abaixo do valor básico soma **+1**. Grupos 2 ou mais pontos abaixo não afetam.

Exemplo do livro: 2 necromantes veteranos (ND 7 → 9), 4 necromantes (ND 4 → 8), 8 esqueletos (ND 2 → 8) e uma armadilha ND 5 (→ 5) = **ND 11**.

Quantidades que não são potência de 2 seguem a mesma curva (3× ND 7 ≈ 10,17) e o resultado é exibido arredondado (ND 10).

## Uso

- O ND aparece no topo do **rastreador de combate**. Passe o mouse para ver um resumo; clique para ver o cálculo completo (e gerar o tesouro, se o *T20 — Gerador de Tesouros* estiver ativo).
- Clique com o botão direito num combatente para **ignorá-lo** no cálculo.
- Com o **T20 — Gerador de Tesouros** ativo, o ND do encontro passa a ser o ND sugerido ao gerar o tesouro.

## Configurações

- Mostrar no rastreador de combate
- Jogadores também veem o ND (padrão: só o mestre)
- Quem conta como ameaça: tokens hostis (padrão) ou todos os combatentes que não são de jogadores
- Arredondamento do ND do encontro (exibido e sugerido ao tesouro): para baixo (padrão) ou para o mais próximo

## API

```js
const api = game.modules.get("t20-calcular-nd-encontro").api;
api.calcular(["5", "5", "4", "1/2"]);   // { nd, basico, grupos, ... }
api.calcularCombate(game.combat);       // + { rotulo: "7", exato: "7", ndTesouro: "7" }
api.ndTesouro();                        // "7"
api.mostrarDetalhes();
```
