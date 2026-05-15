// ============================================================
// STRATÉGIE — Phase de jeu (street)
// Ajustements par phase : préflop, flop, turn, river
// ============================================================

function applyPhaseStrategy(ctx, player, state) {
  const phase = state.phase;

  switch (phase) {
    case 'preflop':
      // Déjà géré par position.js principalement
      // Ici juste le sizing préflop standard
      ctx.adjustedBetMultiplier *= 0.85; // opens plus petites
      break;

    case 'flop':
      // C-bet : si on était le préflop raiser, on continue souvent
      // Détecté indirectement : main > 0.5 sur flop = souvent continuation
      if (ctx.strength > 0.55) {
        ctx.adjustedRaiseThreshold -= 0.04;
      }
      // Semi-bluff avec tirage : plus agressif
      if (ctx.strength > 0.30 && ctx.strength < 0.55) {
        ctx.adjustedBluffFreq += 0.04;
      }
      // Sur le flop, l'incertitude est maximale
      ctx.adjustedBetMultiplier *= 0.9; // sizing plus petit au flop
      break;

    case 'turn':
      // Le turn réduit l'incertitude : les mises grossissent
      ctx.adjustedBetMultiplier *= 1.15;
      // Double barrel : plus sélectif
      if (ctx.strength < 0.45) {
        ctx.adjustedRaiseThreshold += 0.04;
        ctx.adjustedBluffFreq -= 0.03;
      }
      // Si on a une main forte, value bet plus gros
      if (ctx.strength > 0.65) {
        ctx.adjustedBetMultiplier *= 1.1;
      }
      break;

    case 'river':
      // Plus de cartes à venir : décision binaire value/bluff
      // Value bet avec main forte
      if (ctx.strength > 0.75) {
        ctx.adjustedRaiseThreshold -= 0.06;
        ctx.adjustedBetMultiplier *= 1.15;
      }
      // Bluff catch : plus difficile, on fold plus
      if (ctx.strength < 0.35) {
        ctx.adjustedFoldThreshold += 0.08;
      }
      // Bluff river : sizing doit être crédible
      if (ctx.strength < 0.3) {
        ctx.adjustedBetMultiplier *= 0.85; // petit bluff = moins risqué
      }
      break;
  }

  ctx.debug.push('phase:' + phase);
}

registerStrategy(applyPhaseStrategy);
