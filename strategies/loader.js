// ============================================================
// STRATEGY LOADER — Orchestrateur du pipeline stratégique V5
// ============================================================

// --- Contexte de décision (objet partagé par tous les modules) ---
// Chaque module lit/modifie ce contexte. Ordre = position → stack → board → multiway → phase → opponent → gto
function createContext(player, state, handStrength) {
  return {
    // Entrées brutes
    strength: handStrength,
    rawStrength: handStrength,

    // Seuils de départ (seront modulés par les stratégies)
    foldThreshold: 0.25,
    raiseThreshold: 0.65,
    bluffFreq: player.npcTraits ? player.npcTraits.bluffFreq : 0.20,
    betMultiplier: 1.0,

    // Sorties ajustées (initialisées aux valeurs de départ)
    adjustedStrength: handStrength,
    adjustedFoldThreshold: 0.25,
    adjustedRaiseThreshold: 0.65,
    adjustedBluffFreq: player.npcTraits ? player.npcTraits.bluffFreq : 0.20,
    adjustedBetMultiplier: 1.0,

    // État du bluff
    isBluffing: false,

    // Traces pour le log
    debug: [],
    debugTags: [],
  };
}

// --- Pipeline des modules stratégiques ---
// Chaque fonction reçoit (ctx, player, state) et modifie ctx
var STRATEGY_PIPE = [];

function registerStrategy(fn) {
  if (typeof fn === 'function') {
    STRATEGY_PIPE.push(fn);
  }
}

// Exécute tous les modules dans l'ordre, chacun protégé par try/catch
function runStrategyPipe(ctx, player, state) {
  for (const strategyFn of STRATEGY_PIPE) {
    try {
      strategyFn(ctx, player, state);
    } catch (e) {
      // Un module qui plante ne casse pas les autres
      ctx.debug.push('[err:' + (strategyFn.name || 'anon') + ']');
    }
  }
}

// --- Application finale de la personnalité ---
// Blend adaptability, tiltResist, puis les 4 traits actifs (tightness, aggression, bluffFreq, rationality)
function applyPersonalityFinal(ctx, traits, toCall, pot, isPreflop, limitMode, playerId) {
  const t = traits;

  // 1. Blend adaptability : fusion entre rawStrength (ignorer le contexte) et adjustedStrength (suivre le contexte)
  const adapt = t.adaptability || 0.5;
  let blendedStrength = ctx.rawStrength * (1 - adapt) + ctx.adjustedStrength * adapt;
  let blendedFold = 0.25 * (1 - adapt) + ctx.adjustedFoldThreshold * adapt;
  let blendedRaise = 0.65 * (1 - adapt) + ctx.adjustedRaiseThreshold * adapt;
  let blendedBluff = (t.bluffFreq || 0.2) * (1 - adapt * 0.5) + ctx.adjustedBluffFreq * adapt * 0.5;
  let blendedBet = 1.0 * (1 - adapt) + ctx.adjustedBetMultiplier * adapt;

  // 2. Ajustement tightness : un joueur serré sous-évalue sa main
  const tightnessMod = isPreflop ? 1.5 : 1.0;
  const tightnessAdjust = (t.tightness - 0.5) * -0.25 * tightnessMod;
  blendedStrength += tightnessAdjust;

  // Loose : bonus aléatoire
  if (t.tightness < 0.3) {
    blendedStrength += Math.random() * 0.25;
  }

  // 3. Rationalité : variance aléatoire
  const randomVariance = (1 - t.rationality) * 0.20;
  blendedStrength += (Math.random() - 0.5) * randomVariance;

  // 4. Tightness → seuil de fold
  blendedFold = blendedFold * 0.5 + (0.25 + t.tightness * 0.25) * 0.5;

  // 5. Aggression → seuil de raise
  blendedRaise = blendedRaise * 0.5 + (0.65 - t.aggression * 0.25) * 0.5;

  // 6. Bluff fréquence
  blendedBluff = Math.max(0.02, Math.min(0.95, blendedBluff));

  // 7. Ajustement limit mode (comme V4)
  if (limitMode === 'fixedlimit') {
    blendedFold -= 0.14;
    blendedRaise -= 0.10;
  } else if (limitMode === 'potlimit') {
    blendedFold -= 0.06;
    blendedRaise -= 0.04;
  }

  // 8. Tilt : accumulé après bad beats, résisté par tiltResist
  let tiltEffect = 0;
  if (typeof TILT_COUNTERS !== 'undefined' && TILT_COUNTERS[playerId] !== undefined) {
    const tiltResist = t.tiltResist || 0.5;
    tiltEffect = Math.max(0, TILT_COUNTERS[playerId]) * (1 - tiltResist) * 0.15;
  }
  if (tiltEffect > 0) {
    blendedFold -= tiltEffect * 0.6;       // en tilt, on fold moins
    blendedBluff += tiltEffect * 0.8;       // en tilt, on bluffe plus
    blendedRaise -= tiltEffect * 0.3;       // en tilt, on relance plus facilement
    ctx.debugTags.push('TILT');
  }

  // 9. Bluff trigger (comme V4, mais avec blendedBluff)
  const bluffMultiplier = limitMode === 'fixedlimit' ? 1.5 : 1.0;
  const bluffTrigger = blendedBluff * (1 - blendedStrength) * (toCall === 0 ? 1.2 : 0.8) * bluffMultiplier;
  const isBluffing = Math.random() < bluffTrigger;

  // 10. Si bluff, booster la force effective
  const effectiveStrength = isBluffing
    ? Math.max(blendedRaise + 0.05, blendedStrength + 0.3)
    : blendedStrength;

  return {
    effectiveStrength,
    foldThreshold: Math.max(0.05, Math.min(0.95, blendedFold)),
    raiseThreshold: Math.max(0.10, Math.min(0.95, blendedRaise)),
    isBluffing,
    betMultiplier: Math.max(0.5, Math.min(5.0, blendedBet)),
    tiltEffect,
  };
}

// --- Système de tilt global ---
var TILT_COUNTERS = {};

function recordTiltEvent(playerId, isBadBeat) {
  if (!TILT_COUNTERS[playerId]) TILT_COUNTERS[playerId] = 0;
  if (isBadBeat) {
    TILT_COUNTERS[playerId] = Math.min(5, TILT_COUNTERS[playerId] + 1);
  }
}

function decayTilt(playerId) {
  if (TILT_COUNTERS[playerId] && TILT_COUNTERS[playerId] > 0) {
    TILT_COUNTERS[playerId] = Math.max(0, TILT_COUNTERS[playerId] - 0.5);
  }
}
