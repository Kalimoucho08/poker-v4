// ============================================================
// STRATÉGIE — Texture du board
// Classifie le board (dry/wet/paired) et ajuste c-bet/bluff
// ============================================================

function classifyBoard(communityCards) {
  if (communityCards.length < 3) return { texture: 'none', isPaired: false, flushDrawers: 0, straightDrawers: 0 };

  const cards = communityCards;
  const values = cards.map(c => c.value).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);

  // Paired board
  const valueCounts = {};
  values.forEach(v => { valueCounts[v] = (valueCounts[v] || 0) + 1; });
  const isPaired = Object.values(valueCounts).some(c => c >= 2);

  // Flush potential
  const suitCounts = {};
  suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  const maxSuit = Math.max(...Object.values(suitCounts));

  // Straight potential
  const uniqueVals = [...new Set(values)].sort((a, b) => a - b);
  let maxConnected = 1;
  let runLen = 1;
  for (let i = 1; i < uniqueVals.length; i++) {
    if (uniqueVals[i] - uniqueVals[i - 1] <= 2) {
      runLen++;
      maxConnected = Math.max(maxConnected, runLen);
    } else {
      runLen = 1;
    }
  }
  // Vérifier aussi les gaps de 1 (connecteurs directs)
  let directConnectors = 0;
  for (let i = 1; i < uniqueVals.length; i++) {
    if (uniqueVals[i] - uniqueVals[i - 1] === 1) directConnectors++;
  }

  // High cards sur le board
  const highCards = values.filter(v => v >= 11).length;

  // Déterminer la texture
  let texture = 'dry';
  let wetnessScore = 0;

  if (maxSuit >= 3) wetnessScore += (maxSuit - 2) * 2;
  if (directConnectors >= 2) wetnessScore += directConnectors;
  if (maxConnected >= 3) wetnessScore += maxConnected;
  if (highCards >= 2) wetnessScore += 1;

  if (isPaired) {
    texture = 'paired';
  } else if (wetnessScore >= 5) {
    texture = 'veryWet';
  } else if (wetnessScore >= 2) {
    texture = 'wet';
  } else {
    texture = 'dry';
  }

  return {
    texture,
    isPaired,
    flushPossible: maxSuit >= 3,
    straightPossible: maxConnected >= 3 || directConnectors >= 2,
    highCards,
    wetnessScore,
  };
}

function applyBoardTexture(ctx, player, state) {
  if (state.communityCards.length < 3) return; // pas encore de flop

  const board = classifyBoard(state.communityCards);
  ctx._boardTexture = board.texture;

  switch (board.texture) {
    case 'dry':
      // Board sec (ex: K-7-2 rainbow) : c-bet fréquent, petit sizing
      ctx.adjustedRaiseThreshold -= 0.06;
      ctx.adjustedBluffFreq += 0.06;
      ctx.adjustedBetMultiplier *= 0.75; // petits paris suffisent
      break;

    case 'wet':
      // Board draw-heavy (ex: J-9-7 two-tone) : prudence avec main faible
      if (ctx.strength < 0.5) {
        ctx.adjustedFoldThreshold += 0.08;
        ctx.adjustedBluffFreq -= 0.05;
      } else {
        // Main forte sur board humide = protéger
        ctx.adjustedBetMultiplier *= 1.3; // plus gros sizing pour protéger
      }
      ctx.debugTags.push('WET');
      break;

    case 'veryWet':
      // Board très dangereux (ex: J-T-9 suited)
      if (ctx.strength < 0.6) {
        ctx.adjustedFoldThreshold += 0.12;
        ctx.adjustedBluffFreq -= 0.10;
      } else {
        ctx.adjustedBetMultiplier *= 1.5;
      }
      ctx.debugTags.push('vWET');
      break;

    case 'paired':
      // Board pairé (ex: 8-8-3) : bon pour c-bet et bluff
      ctx.adjustedRaiseThreshold -= 0.04;
      ctx.adjustedBetMultiplier *= 0.70;
      // Bon spot de bluff (le board pairé hit rarement les ranges)
      if (ctx.strength < 0.4) {
        ctx.adjustedBluffFreq += 0.08;
      }
      break;
  }

  ctx.debug.push('board:' + board.texture);
}

registerStrategy(applyBoardTexture);
