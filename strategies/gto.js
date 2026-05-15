// ============================================================
// STRATÉGIE — Fréquences GTO
// Bluff optimal, Minimum Defense Frequency
// ============================================================

// Fréquence de bluff optimale (Sklansky)
function optimalBluffFrequency(betSize, potSize) {
  if (potSize <= 0 || betSize <= 0) return 0.33;
  return betSize / (potSize + 2 * betSize);
}

// Minimum Defense Frequency
function minimumDefenseFrequency(betSize, potSize) {
  if (potSize <= 0) return 1.0;
  return potSize / (potSize + betSize);
}

// Ratio bluff-to-value optimal sur la rivière
function optimalBluffToValueRatio(betSize, potSize) {
  if (potSize <= 0) return 0.5;
  return betSize / (potSize + betSize);
}

// Règle des 2 et 4 : convertir les outs en équité
function outsToEquity(outs, streetsToCome) {
  if (streetsToCome >= 2) return Math.min(0.95, outs * 4 / 100);
  return Math.min(0.95, outs * 2 / 100);
}

function applyGTO(ctx, player, state) {
  const toCall = state.currentBet - player.currentBet;
  const totalPot = state.pot + state.players.reduce((s, p) => s + p.currentBet, 0);

  // Ajuster la fréquence de bluff vers l'optimal GTO (blend 30%)
  if (toCall > 0 && totalPot > 0) {
    // Si on fait face à une mise, vérifier la MDF
    const mdf = minimumDefenseFrequency(toCall, totalPot);
    // Si la MDF exige qu'on défende plus que notre tendance actuelle
    const currentDefense = 1 - ctx.adjustedFoldThreshold;
    if (currentDefense < mdf && ctx.strength > 0.25) {
      // Ajuster légèrement vers la MDF (blend 30%)
      ctx.adjustedFoldThreshold -= (mdf - currentDefense) * 0.30;
    }
  }

  // Blend de la fréquence de bluff vers l'optimal GTO
  if (state.communityCards.length >= 5) {
    // River : le ratio bluff-to-value est critique
    const typicalBetSize = totalPot * 0.66; // mise typique de 66% pot
    const gtoBluffFreq = optimalBluffFrequency(typicalBetSize, totalPot);
    // Blend 30% vers le GTO
    ctx.adjustedBluffFreq = ctx.adjustedBluffFreq * 0.70 + gtoBluffFreq * 0.30;
  } else if (state.communityCards.length >= 3) {
    // Flop/Turn : semi-bluff plus fréquent que bluff pur
    const gtoBluffFreq = optimalBluffFrequency(totalPot * 0.5, totalPot);
    ctx.adjustedBluffFreq = ctx.adjustedBluffFreq * 0.85 + gtoBluffFreq * 0.15;
  }

  ctx.debug.push('gto');
}

registerStrategy(applyGTO);
