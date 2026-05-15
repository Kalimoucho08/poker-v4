// ============================================================
// DECIDE.JS — Moteur de décision PNJ enrichi (V5)
// Point d'entrée : npcDecide() + npcThinkDelay()
// Dépend de : npcs.js, strategies/*.js
// ============================================================

// --- Délai de réflexion du PNJ (identique V4) ---
function npcThinkDelay(player) {
  const template = NPC_TEMPLATES.find(t => t.id === player.npcId);
  const baseSpeed = template ? template.speed : 1000;
  return baseSpeed + (Math.random() - 0.5) * baseSpeed * 0.6;
}

// --- Fonction principale de décision PNJ (V5 enrichie) ---
// Retourne { action: 'fold'|'check'|'call'|'raise', amount?: number }
function npcDecide(player, state) {
  const traits = player.npcTraits;
  const toCall = state.currentBet - player.currentBet;
  const pot = state.pot + state.players.reduce((s, p) => s + p.currentBet, 0);
  const isPreflop = state.phase === 'preflop';
  const canCheck = toCall === 0;

  // 1. Évaluer la force brute de la main
  const handStrength = isPreflop
    ? preflopStrength(player.holeCards[0], player.holeCards[1])
    : postflopStrength(player.holeCards, state.communityCards);

  // 2. Créer le contexte stratégique
  const ctx = createContext(player, state, handStrength);

  // 3. Exécuter le pipeline stratégique (position → stack → board → multiway → phase → opponent → gto)
  runStrategyPipe(ctx, player, state);

  // 4. Appliquer la personnalité finale (blend adaptability + tiltResist + traits)
  const decision = applyPersonalityFinal(
    ctx, traits, toCall, pot, isPreflop, state.limitMode || 'nolimit', player.id
  );

  const effectiveStrength = decision.effectiveStrength;

  let action, amount;

  // --- Même logique de décision que V4, mais avec les seuils enrichis ---

  const shortStackPressure = player.chips < state.bigBlind * 5;
  const desperateAllIn = shortStackPressure && effectiveStrength > 0.4 && Math.random() < traits.aggression;
  const callIsAllIn = toCall >= player.chips;

  if (callIsAllIn) {
    if (effectiveStrength < decision.foldThreshold + 0.15) {
      action = 'fold';
    } else {
      action = 'call';
    }
  } else if (desperateAllIn) {
    action = 'raise';
    amount = player.currentBet + player.chips;
  } else if (effectiveStrength < decision.foldThreshold && !canCheck) {
    action = 'fold';
  } else if (effectiveStrength > decision.raiseThreshold) {
    action = 'raise';
    if (state.limitMode === 'fixedlimit') {
      amount = typeof getFixedLimitBet === 'function' ? state.currentBet + getFixedLimitBet() : state.currentBet + state.bigBlind;
      if (state.roundRaiseCount >= 4) {
        action = toCall > 0 ? 'call' : 'check';
      }
    } else {
      // npcRaiseSizing utilise le betMultiplier enrichi
      amount = npcRaiseSizing(
        handStrength,
        state.currentBet,
        state.minRaise,
        pot,
        player.chips,
        traits,
        player.npcId
      );
      // Appliquer le betMultiplier du contexte (stack depth, phase, etc.)
      if (decision.betMultiplier !== 1.0) {
        const baseCall = state.currentBet;
        const raisePart = amount - baseCall;
        amount = Math.floor(baseCall + raisePart * decision.betMultiplier);
      }
      // Pot-Limit cap
      if (state.limitMode === 'potlimit') {
        const maxTotal = player.currentBet + pot + 2 * toCall;
        if (amount > maxTotal) amount = maxTotal;
      }
    }

    const minTotal = state.currentBet + (state.limitMode === 'fixedlimit' ? (typeof getFixedLimitBet === 'function' ? getFixedLimitBet() : state.bigBlind) : state.minRaise);
    if (amount < minTotal) amount = minTotal;
    if (amount > player.chips + player.currentBet) amount = player.chips + player.currentBet;
    const totalNeeded = amount - player.currentBet;
    if (totalNeeded <= 0) {
      action = canCheck ? 'check' : 'call';
    }
  } else if (canCheck) {
    action = 'check';
  } else {
    action = 'call';
  }

  // --- Log enrichi V5 ---
  const thought = decision.isBluffing ? ' [BLUFF!]' : '';
  const strengthPct = Math.round(handStrength * 100);
  const tags = ctx.debugTags.length > 0 ? ' [' + ctx.debugTags.join('|') + ']' : '';

  if (!window._npcSilentMode) {
    const positionTag = ctx._positionLabel || '';
    addLog(`  🤖 ${player.name} (${player.npcName})${positionTag}${tags}: main ~${strengthPct}%, ${action}${thought}`);
  }

  // Catchphrase occasionnelle
  const template = NPC_TEMPLATES.find(t => t.id === player.npcId);
  if (template && template.catchphrase && (action === 'raise' || (action === 'fold' && toCall > 0 && handStrength > 0.3))) {
    if (Math.random() < 0.15) {
      addLog(`  💬 ${player.name} : « ${template.catchphrase} »`);
    }
  }

  // Stocker pour le panneau de conseils
  if (window._lastNpcDecision) {
    window._lastNpcDecision = {
      playerName: player.name,
      npcName: player.npcName,
      handStrength,
      effectiveStrength,
      action,
      amount,
      isBluffing: decision.isBluffing,
      tags: ctx.debugTags,
      positionLabel: ctx._positionLabel,
      stackZone: ctx._stackZone,
      boardTexture: ctx._boardTexture,
      spr: ctx._spr,
    };
  }

  return { action, amount };
}
