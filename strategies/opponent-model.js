// ============================================================
// STRATÉGIE — Modélisation des adversaires
// Tracking VPIP/PFR, classification, ajustements exploitatifs
// ============================================================

// Base de données d'observation par joueur
var OBSERVATIONS = {};

function getPlayerStats(playerId) {
  if (!OBSERVATIONS[playerId]) {
    OBSERVATIONS[playerId] = {
      totalHands: 0,
      preflopActions: 0,
      preflopRaises: 0,
      preflopCalls: 0,
      preflopFolds: 0,
      flopActions: 0,
      flopBets: 0,
      flopCalls: 0,
      flopFolds: 0,
      totalBets: 0,
      totalCalls: 0,
      totalFolds: 0,
      totalActions: 0,
      handsSeen: 0,
    };
  }
  return OBSERVATIONS[playerId];
}

// Appelé depuis game.js après chaque action joueur
function recordAction(playerId, action, amount, phase, isPreflop) {
  const stats = getPlayerStats(playerId);
  stats.totalActions++;

  if (isPreflop) {
    stats.preflopActions++;
    if (action === 'raise') stats.preflopRaises++;
    if (action === 'call') stats.preflopCalls++;
    if (action === 'fold') stats.preflopFolds++;
  } else {
    stats.flopActions++;
    if (action === 'raise') stats.flopBets++;
    if (action === 'call') stats.flopCalls++;
    if (action === 'fold') stats.flopFolds++;
  }

  if (action === 'raise') stats.totalBets++;
  if (action === 'call') stats.totalCalls++;
  if (action === 'fold') stats.totalFolds++;
}

// Enregistre qu'un joueur a vu le flop
function recordSawFlop(playerId) {
  const stats = getPlayerStats(playerId);
  stats.handsSeen++;
}

// Calcule les stats dérivées
function computeStats(stats) {
  // VPIP = % de mains où le joueur met volontairement de l'argent
  const vpip = stats.preflopActions > 0
    ? (stats.preflopRaises + stats.preflopCalls) / stats.preflopActions
    : 0;

  // PFR = % de mains où le joueur relance préflop
  const pfr = stats.preflopActions > 0
    ? stats.preflopRaises / stats.preflopActions
    : 0;

  // Facteur d'agression = (bets + raises) / calls
  const aggFreq = stats.totalCalls > 0
    ? stats.totalBets / (stats.totalBets + stats.totalCalls)
    : 0.5;

  // Fold to c-bet
  const foldToCbet = stats.flopFolds + stats.flopCalls + stats.flopBets > 0
    ? stats.flopFolds / (stats.flopFolds + stats.flopCalls + stats.flopBets)
    : 0.5;

  return { vpip, pfr, aggFreq, foldToCbet };
}

// Classification de l'adversaire
function classifyOpponent(stats) {
  const { vpip, pfr } = computeStats(stats);

  if (stats.totalActions < 10) return 'unknown'; // pas assez de données

  if (vpip < 0.20 && pfr < 0.10) return 'rock';          // Tight-Passive
  if (vpip < 0.25 && pfr >= 0.12) return 'tag';           // Tight-Aggressive
  if (vpip >= 0.35 && pfr >= 0.20) return 'lag';          // Loose-Aggressive
  if (vpip >= 0.40 && pfr < 0.12) return 'station';       // Calling Station
  if (vpip >= 0.35 && pfr >= 0.28) return 'maniac';       // Maniac

  return 'balanced';
}

function applyOpponentModel(ctx, player, state) {
  // Analyser les adversaires encore actifs
  const opponents = state.players.filter(p => p.id !== player.id && !p.folded && p.chips > 0);

  let totalAggression = 0;
  let totalFoldiness = 0;
  let classifiedCount = 0;

  for (const opp of opponents) {
    const stats = getPlayerStats(opp.id);
    if (stats.totalActions < 5) continue; // pas assez de données

    const { vpip, pfr, aggFreq, foldToCbet } = computeStats(stats);
    const type = classifyOpponent(stats);

    totalAggression += aggFreq;
    totalFoldiness += foldToCbet;
    classifiedCount++;

    // Ajustements spécifiques par type d'adversaire
    switch (type) {
      case 'rock':
        // Contre un Rock : bluffer plus, voler ses blinds
        ctx.adjustedBluffFreq += 0.03;
        break;
      case 'station':
        // Contre une Calling Station : ne jamais bluffer, value bet thin
        ctx.adjustedBluffFreq -= 0.06;
        break;
      case 'maniac':
        // Contre un Maniac : laisser le bluffer, trap avec mains fortes
        ctx.adjustedRaiseThreshold += 0.03;
        break;
      case 'lag':
        // Contre un LAG : plus prudent, éviter les confrontations marginales
        ctx.adjustedFoldThreshold += 0.02;
        break;
    }
  }

  if (classifiedCount > 0) {
    const avgAggression = totalAggression / classifiedCount;
    const avgFoldiness = totalFoldiness / classifiedCount;

    // Table globalement agressive : on serre le jeu
    if (avgAggression > 0.7 && classifiedCount >= 2) {
      ctx.adjustedFoldThreshold += 0.03;
    }

    // Table globalement passive/fold : on peut bluffer plus
    if (avgFoldiness > 0.6 && classifiedCount >= 2) {
      ctx.adjustedBluffFreq += 0.04;
      ctx.adjustedRaiseThreshold -= 0.03;
    }
  }

  if (classifiedCount > 0) ctx.debug.push('opp:' + classifiedCount);
}

registerStrategy(applyOpponentModel);
