// ============================================================
// STRATÉGIE — Profondeur de stack & SPR
// Zones short/medium/deep, push/fold, ratio stack/pot
// ============================================================

// Zone de stack basée sur le nombre de big blinds
function getStackZone(chips, bigBlind) {
  if (chips <= 0) return 'eliminated';
  const bb = chips / bigBlind;
  if (bb < 8) return 'red';        // push/fold uniquement
  if (bb < 15) return 'orange';    // très short
  if (bb < 25) return 'yellow';    // short
  if (bb < 50) return 'green';     // standard
  if (bb < 100) return 'deep';     // deep
  return 'veryDeep';               // très deep
}

// M-ratio de Harrington : M = stack / (SB+BB)
function getMRatio(chips, smallBlind, bigBlind) {
  return chips / (smallBlind + bigBlind);
}

// Stack-to-Pot Ratio (calculé au flop)
function calculateSPR(effectiveStack, pot) {
  if (pot <= 0) return 999;
  return effectiveStack / pot;
}

// Trouve le stack effectif (le plus petit stack parmi les joueurs actifs)
function getEffectiveStack(player, state) {
  let minStack = player.chips;
  for (const p of state.players) {
    if (!p.folded && p.id !== player.id && p.chips > 0) {
      minStack = Math.min(minStack, p.chips);
    }
  }
  return minStack;
}

function applyStackDepth(ctx, player, state) {
  const zone = getStackZone(player.chips, state.bigBlind);
  const mRatio = getMRatio(player.chips, state.smallBlind, state.bigBlind);
  const isPreflop = state.phase === 'preflop';

  ctx._stackZone = zone;

  switch (zone) {
    case 'red':
      // Push/fold : on relance all-in avec toute main jouable
      ctx.adjustedRaiseThreshold -= 0.20;
      ctx.adjustedFoldThreshold -= 0.10;
      ctx.adjustedBetMultiplier = 5.0; // pousse all-in
      ctx.debugTags.push('RED');
      break;

    case 'orange':
      // Très short : serré mais agressif
      ctx.adjustedRaiseThreshold -= 0.10;
      if (isPreflop) ctx.adjustedFoldThreshold += 0.04;
      ctx.adjustedBetMultiplier = 2.5;
      ctx.debugTags.push('ORANGE');
      break;

    case 'yellow':
      // Short : légèrement plus serré, sizing plus gros
      ctx.adjustedRaiseThreshold -= 0.04;
      ctx.adjustedBetMultiplier = 1.3;
      break;

    case 'deep':
      // Deep stack : implied odds, on peut jouer plus spéculatif
      if (isPreflop) ctx.adjustedFoldThreshold -= 0.04;
      ctx.adjustedBetMultiplier = 1.15;
      ctx.debugTags.push('DEEP');
      break;

    case 'veryDeep':
      // Très deep : implied odds max
      if (isPreflop) ctx.adjustedFoldThreshold -= 0.06;
      ctx.adjustedBetMultiplier = 1.2;
      ctx.debugTags.push('vDEEP');
      break;

    default:
      // green zone : standard
      break;
  }

  // SPR (postflop uniquement)
  if (state.communityCards.length >= 3) {
    const totalPot = state.pot + state.players.reduce((s, p) => s + p.currentBet, 0);
    const effStack = getEffectiveStack(player, state);
    const spr = calculateSPR(effStack, totalPot);
    ctx._spr = spr;

    // Commitment thresholds basés sur le SPR
    if (spr < 4) {
      // SPR bas : commit avec top paire+
      if (ctx.strength > 0.35) {
        ctx.adjustedRaiseThreshold -= 0.20;
        ctx.debugTags.push('LOWSPR');
      }
    } else if (spr < 7) {
      // SPR moyen : commit avec deux paires+
      if (ctx.strength > 0.55) {
        ctx.adjustedRaiseThreshold -= 0.12;
      }
    } else if (spr > 16) {
      // SPR élevé : prudence, near-nuts requis pour commit
      if (ctx.strength < 0.80) {
        ctx.adjustedRaiseThreshold += 0.08;
      }
      ctx.debugTags.push('HIGHSPR');
    }
  }

  // M-ratio très bas = mode survie
  if (mRatio < 5 && ctx.strength > 0.30 && isPreflop) {
    ctx.adjustedRaiseThreshold -= 0.10;
    ctx.debugTags.push('SURVIVAL');
  }

  ctx.debug.push('stack:' + zone + ' M:' + Math.round(mRatio));
}

registerStrategy(applyStackDepth);
