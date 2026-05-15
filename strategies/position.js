// ============================================================
// STRATÉGIE — Position à la table
// Ajuste les seuils selon UTG/MP/CO/BTN/SB/BB
// ============================================================

// Calcule la position relative d'un joueur
// Retourne un indice 0-5 (0=UTG précoce, 5=BTN, 6=SB, 7=BB)
function getPositionIndex(player, state) {
  const n = state.players.length;
  const playerIdx = state.players.indexOf(player);
  if (playerIdx === -1) return 3; // fallback middle

  // Nombre de joueurs actifs encore en lice
  const activePlayers = state.players.filter(p => p.chips > 0);
  const activeCount = activePlayers.length;

  if (activeCount === 2) {
    // Heads-up : dealer = SB (agit premier préflop, dernier postflop)
    if (playerIdx === state.dealerIndex) return 5; // SB/BTN
    return 7; // BB
  }

  // Calculer combien de joueurs agissent après ce joueur (en sautant les éliminés)
  let playersAfter = 0;
  const nPlayers = state.players.length;
  for (let i = 1; i < nPlayers; i++) {
    const checkIdx = (playerIdx + i) % nPlayers;
    const p = state.players[checkIdx];
    if (p.chips > 0 && checkIdx !== state.dealerIndex) {
      // Compter les joueurs actifs entre ce joueur et le dealer (dans le sens du jeu)
    }
  }

  // Méthode plus simple : compter les joueurs actifs entre ce joueur et le bouton
  // La position = combien de joueurs doivent encore parler après moi
  let posInOrder = 0;
  for (let i = 1; i < nPlayers; i++) {
    const idx = (state.dealerIndex + i) % nPlayers;
    if (idx === playerIdx) break;
    if (state.players[idx].chips > 0) posInOrder++;
  }

  return posInOrder; // 0 = premier à parler après le dealer (UTG précoce)
}

function getPositionLabel(player, state) {
  const n = state.players.length;
  const activePlayers = state.players.filter(p => p.chips > 0).length;

  if (activePlayers === 2) {
    const playerIdx = state.players.indexOf(player);
    if (playerIdx === state.dealerIndex) return 'SB/BTN';
    return 'BB';
  }

  const posIdx = getPositionIndex(player, state);
  const totalActive = activePlayers;

  // Mapping position → label selon le nombre de joueurs
  if (totalActive <= 3) {
    if (posIdx === 0) return 'BTN';
    if (posIdx === 1) return 'SB';
    return 'BB';
  }

  if (totalActive <= 4) {
    if (posIdx === 0) return 'CO';
    if (posIdx === 1) return 'BTN';
    if (posIdx === 2) return 'SB';
    return 'BB';
  }

  // 5+ joueurs
  if (posIdx === 0) return 'UTG';
  if (posIdx === totalActive - 3) return 'CO';
  if (posIdx === totalActive - 2) return 'BTN';
  if (posIdx === totalActive - 1) return 'SB';
  if (posIdx === totalActive) return 'BB';
  return 'MP';
}

function applyPosition(ctx, player, state) {
  const isPreflop = state.phase === 'preflop';
  const posIdx = getPositionIndex(player, state);
  const activePlayers = state.players.filter(p => p.chips > 0).length;
  const label = getPositionLabel(player, state);

  ctx._positionLabel = ' [' + label + ']';

  if (isPreflop) {
    // Ajustements préflop par position relative
    // Plus on est proche du bouton, plus on peut jouer large
    const totalPositions = Math.max(2, activePlayers);
    const positionRatio = posIdx / Math.max(1, totalPositions - 1); // 0 = early, 1 = late

    // Early position : plus serré (foldThreshold monte)
    const earlyTightness = (1 - positionRatio) * 0.18;
    ctx.adjustedFoldThreshold += earlyTightness;

    // Late position : plus agressif (raiseThreshold baisse)
    const lateAggression = positionRatio * 0.15;
    ctx.adjustedRaiseThreshold -= lateAggression;

    // BB défend plus large
    if (label === 'BB') {
      ctx.adjustedFoldThreshold -= 0.08;
      ctx.adjustedRaiseThreshold -= 0.04;
    }

    // SB complète plus souvent en late position
    if (label === 'SB') {
      ctx.adjustedFoldThreshold -= 0.04;
    }

    // Gap concept : caller un raise demande une main plus forte qu'ouvrir
    const toCall = state.currentBet - player.currentBet;
    if (toCall > state.bigBlind) {
      ctx.adjustedFoldThreshold += 0.06; // plus strict pour caller
    }
  } else {
    // Postflop : être hors de position est un désavantage
    if (posIdx < activePlayers / 2) {
      ctx.adjustedFoldThreshold += 0.06; // OOP = plus prudent
    } else {
      ctx.adjustedRaiseThreshold -= 0.04; // IP = plus agressif
      ctx.adjustedBluffFreq += 0.04;
    }
  }

  ctx.debug.push('pos:' + label);
}

// Enregistrer dans le pipeline
registerStrategy(applyPosition);
