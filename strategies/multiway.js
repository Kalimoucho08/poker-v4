// ============================================================
// STRATÉGIE — Nombre de joueurs (multiway)
// Ajuste l'agressivité selon le nombre d'adversaires
// ============================================================

function applyMultiway(ctx, player, state) {
  const activePlayers = state.players.filter(p => !p.folded && p.chips > 0);
  const count = activePlayers.length;

  if (count === 2) {
    // Heads-up : beaucoup plus agressif, ranges très larges
    ctx.adjustedFoldThreshold -= 0.12;
    ctx.adjustedRaiseThreshold -= 0.10;
    ctx.adjustedBluffFreq += 0.08;
    ctx.adjustedBetMultiplier *= 0.90; // sizing plus petit en HU
    ctx.debugTags.push('HU');
  } else if (count === 3) {
    // 3-handed : plus agressif
    ctx.adjustedFoldThreshold -= 0.06;
    ctx.adjustedRaiseThreshold -= 0.05;
    ctx.adjustedBluffFreq += 0.04;
    ctx.debugTags.push('3H');
  } else if (count === 4) {
    // 4-handed : légèrement plus large que standard
    ctx.adjustedFoldThreshold -= 0.02;
    ctx.adjustedRaiseThreshold -= 0.02;
  } else if (count >= 6) {
    // 6+ joueurs : plus serré, surtout postflop
    if (state.communityCards.length > 0) {
      ctx.adjustedFoldThreshold += 0.08;
      ctx.adjustedBluffFreq -= 0.06;
    } else {
      ctx.adjustedFoldThreshold += 0.04;
    }
    ctx.adjustedBetMultiplier *= 1.1; // sizing plus gros pour réduire le field
    if (count >= 7) ctx.debugTags.push('FULL');
  }

  // Postflop multiway : c-bet beaucoup moins fréquent
  if (state.communityCards.length >= 3 && count >= 4) {
    ctx.adjustedRaiseThreshold += 0.06;
    ctx.adjustedBluffFreq -= 0.08;
  }

  ctx.debug.push('vs' + count);
}

registerStrategy(applyMultiway);
