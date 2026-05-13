// ============================================================
// PNJ — Personnages Non-Joueurs pour Texas Hold'em Poker V2
// Templates de personnalité + moteur de décision IA
// ============================================================

// --- Templates de PNJ ---
// Chaque PNJ a 6 traits (0-1) qui influencent ses décisions:
//   tightness    : sélectivité des mains de départ (1 = très serré)
//   aggression   : tendance à relancer plutôt que suivre (1 = très agressif)
//   bluffFreq    : fréquence de bluff (1 = bluffe souvent)
//   rationality  : respect des cotes mathématiques (1 = purement mathématique)
//   adaptability : capacité à changer de style selon le contexte (1 = très adaptable)
//   tiltResist   : résistance au tilt après un bad beat (1 = imperturbable)

const NPC_TEMPLATES = [
  {
    id: 'le_roc',
    name: 'Le Roc',
    emoji: '🪨',
    archetype: 'Tight-Passive',
    description: 'Solide comme un roc. Ne mise que sur des certitudes.',
    backstory: 'Ancien comptable reconverti au poker. A construit sa bankroll centime par centime.',
    traits: { tightness: 0.90, aggression: 0.15, bluffFreq: 0.05, rationality: 0.80, adaptability: 0.20, tiltResist: 0.90 },
    catchphrase: 'On ne gagne pas une guerre en une bataille.',
    tell: 'Prend toujours 3 secondes avant de relancer — c\'est le seul moment où il accélère.',
    speed: 1400,  // ms de réflexion (lent)
    color: '#95a5a6',
  },
  {
    id: 'le_requin',
    name: 'Le Requin',
    emoji: '🦈',
    archetype: 'Tight-Aggressive',
    description: 'Patient, précis, mortel. Le profil gagnant classique.',
    backstory: 'Joueur professionnel depuis 10 ans. Vit du poker. Ne montre jamais ses émotions.',
    traits: { tightness: 0.70, aggression: 0.75, bluffFreq: 0.25, rationality: 0.90, adaptability: 0.60, tiltResist: 0.70 },
    catchphrase: 'Le poker, c\'est un jeu de personnes déguisé en jeu de cartes.',
    tell: 'Fixe le pot quand il a une main forte, fixe ses jetons quand il bluffe.',
    speed: 900,
    color: '#2980b9',
  },
  {
    id: 'le_gambler',
    name: 'Le Gambler',
    emoji: '🎲',
    archetype: 'Loose-Aggressive',
    description: 'L\'adrénaline avant tout. Relance, bluffe, provoque.',
    backstory: 'Ex-trader à Wall Street. Joue comme il vivait : vite, fort, sans filet.',
    traits: { tightness: 0.30, aggression: 0.85, bluffFreq: 0.60, rationality: 0.40, adaptability: 0.50, tiltResist: 0.20 },
    catchphrase: 'Si tu n\'as pas peur, c\'est que tu ne mises pas assez.',
    tell: 'Joue avec ses jetons en permanence, sauf quand il a les nuts — alors il s\'immobilise.',
    speed: 600,
    color: '#e74c3c',
  },
  {
    id: 'le_professeur',
    name: 'Le Professeur',
    emoji: '🧠',
    archetype: 'GTO / Calculé',
    description: 'Calcule chaque cote, chaque pourcentage. Clinique.',
    backstory: 'Docteur en mathématiques. A écrit sa thèse sur la théorie des jeux appliquée au poker.',
    traits: { tightness: 0.60, aggression: 0.55, bluffFreq: 0.35, rationality: 0.95, adaptability: 0.80, tiltResist: 0.75 },
    catchphrase: 'Statistiquement, vous auriez dû vous coucher.',
    tell: 'Annonce parfois le pourcentage de chance qu\'il a de gagner. Ne ment jamais sur les chiffres.',
    speed: 1000,
    color: '#2ecc71',
  },
  {
    id: 'le_poisson',
    name: 'Le Poisson',
    emoji: '🐟',
    archetype: 'Loose-Passive',
    description: 'Joue pour le plaisir. Suit tout, relance peu, rêve de couleurs.',
    backstory: 'Joueur récréatif du dimanche. A découvert le poker sur son téléphone. S\'amuse avant tout.',
    traits: { tightness: 0.15, aggression: 0.10, bluffFreq: 0.02, rationality: 0.30, adaptability: 0.10, tiltResist: 0.60 },
    catchphrase: 'Je suis venu pour la couleur... je paye !',
    tell: 'Sourit quand il touche une paire, même sur le flop le plus dangereux du monde.',
    speed: 500,
    color: '#f39c12',
  },
  {
    id: 'l_artiste',
    name: 'L\'Artiste',
    emoji: '🎨',
    archetype: 'Créatif / Imprévisible',
    description: 'Un jour le génie, un jour le fou. Personne ne sait lire son jeu.',
    backstory: 'Peintre bohème. Voit le poker comme une toile : parfois un chef-d\'oeuvre, parfois du chaos.',
    traits: { tightness: 0.50, aggression: 0.50, bluffFreq: 0.70, rationality: 0.50, adaptability: 0.90, tiltResist: 0.30 },
    catchphrase: 'Les règles sont pour les autres — moi, je peins.',
    tell: 'Change complètement de style de jeu après chaque main gagnée ou perdue.',
    speed: 800,
    color: '#9b59b6',
  },
];

// --- Évaluation de la force de la main ---

// Pré-flop: score 0-1 basé sur la force intrinsèque des deux cartes
function preflopStrength(card1, card2) {
  if (!card1 || !card2) return 0.05; // sécurité: joueur sans cartes
  const v1 = card1.value;
  const v2 = card2.value;
  const suited = card1.suit === card2.suit;
  const paired = v1 === v2;
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  const gap = high - low;

  let score = 0;

  // Bonus de carte haute (0-0.5)
  score += (high - 2) / 12 * 0.25;
  score += (low - 2) / 12 * 0.15;

  // Bonus paire (0-0.35)
  if (paired) {
    score += 0.10 + (high - 2) / 12 * 0.25;
  }

  // Bonus suited (0-0.10)
  if (suited) {
    score += 0.06 + (1 - gap / 12) * 0.04;
  }

  // Bonus connecteurs (0-0.10)
  if (gap <= 2 && !paired) {
    score += 0.08 - gap * 0.03;
  }
  if (gap <= 4 && !paired) {
    score += 0.03;
  }

  // Bonus Broadway (2 cartes >= 10)
  if (high >= 10 && low >= 10) {
    score += 0.10;
  }

  // Pénalité pour les très petites cartes
  if (high < 7 && !paired && !suited && gap > 3) {
    score -= 0.10;
  }

  return Math.max(0.05, Math.min(0.98, score));
}

// Post-flop: score 0-1 utilisant l'évaluateur de game.js
function postflopStrength(holeCards, communityCards) {
  if (communityCards.length === 0) return preflopStrength(holeCards[0], holeCards[1]);

  const allCards = [...holeCards, ...communityCards];
  const bestHand = evaluateHand(allCards);
  if (!bestHand) return 0.1;

  // Score basé sur le type de main (0-8)
  const baseScore = bestHand.type / 8;

  // Ajuster avec la force relative dans le type (via les rangs encodés)
  const typeMax = bestHand.type * Math.pow(13, 5) + 4 * Math.pow(13, 4) + 4 * Math.pow(13, 3) + 4 * Math.pow(13, 2) + 4 * 13 + 4;
  const typeMin = bestHand.type * Math.pow(13, 5);
  const typeRange = typeMax - typeMin;
  const relativeStrength = typeRange > 0 ? (bestHand.value - typeMin) / typeRange : 0.5;

  // Bonus tirage (potentiel d'amélioration)
  const drawBonus = estimateDrawPotential(holeCards, communityCards);

  // Combiner: 70% force absolue, 15% rang relatif, 15% potentiel tirage
  return baseScore * 0.70 + relativeStrength * 0.15 + drawBonus * 0.15;
}

// Estimation du potentiel de tirage (outs normalisés)
function estimateDrawPotential(holeCards, communityCards) {
  if (communityCards.length < 3) return 0.3;

  const allSuits = [...holeCards, ...communityCards].map(c => c.suit);
  const allValues = [...holeCards, ...communityCards].map(c => c.value);

  // Compte les cartes par couleur
  const suitCounts = {};
  for (const s of allSuits) suitCounts[s] = (suitCounts[s] || 0) + 1;

  let maxOuts = 0;

  // Tirage couleur: 4 cartes de la même couleur = 9 outs
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count === 4) maxOuts = Math.max(maxOuts, 9);
    else if (count === 3) maxOuts = Math.max(maxOuts, 5); // backdoor
  }

  // Tirage quinte: chercher des séquences
  const uniqueSorted = [...new Set(allValues)].sort((a, b) => a - b);
  for (let i = 0; i <= uniqueSorted.length - 4; i++) {
    const needed = 4;
    let present = 0;
    for (let j = 0; j < 5; j++) {
      if (uniqueSorted.includes(uniqueSorted[i] - 2 + j)) present++;
    }
    if (present >= 3) maxOuts = Math.max(maxOuts, 8);
    if (present >= 2) maxOuts = Math.max(maxOuts, 4);
  }

  return Math.min(1, maxOuts / 12);
}

// --- Fonctions de décision ---

function calculatePotOdds(toCall, pot) {
  if (toCall === 0) return 0;
  return toCall / (pot + toCall);
}

// Applique les traits de personnalité au score de main
// limitMode: 'nolimit' | 'potlimit' | 'fixedlimit' — ajuste les seuils selon la structure de mise
function applyPersonality(handStrength, toCall, pot, traits, isPreflop, limitMode) {
  const t = traits;

  // Ajustement tightness: un joueur serré sous-évalue sa main, un loose la surévalue
  // Au préflop, l'effet est amplifié
  const tightnessMod = isPreflop ? 1.5 : 1.0;
  const tightnessAdjust = (t.tightness - 0.5) * -0.25 * tightnessMod;
  let adjusted = handStrength + tightnessAdjust;

  // Loose: ajoute un bonus aléatoire (voit des monstres partout)
  if (t.tightness < 0.3) {
    adjusted += Math.random() * 0.25;
  }

  // Rationalité: facteur de confiance dans l'évaluation mathématique vs instinct
  const randomVariance = (1 - t.rationality) * 0.20;
  adjusted += (Math.random() - 0.5) * randomVariance;

  // Seuils de décision personnalisés
  const baseFoldThreshold = 0.25;
  const baseRaiseThreshold = 0.65;

  // Un joueur tight a un seuil de fold plus élevé
  let foldThreshold = baseFoldThreshold + t.tightness * 0.25;
  // Un joueur agressif a un seuil de raise plus bas
  let raiseThreshold = baseRaiseThreshold - t.aggression * 0.25;

  // Ajustement selon la structure de mise
  if (limitMode === 'fixedlimit') {
    // Fixed Limit: coût fixe et faible → on joue plus large
    foldThreshold -= 0.14;
    raiseThreshold -= 0.10;
    // En fixed limit, le bluff est moins cher donc plus fréquent
  } else if (limitMode === 'potlimit') {
    // Pot Limit: ajustement modéré
    foldThreshold -= 0.06;
    raiseThreshold -= 0.04;
  }
  // No Limit: pas d'ajustement (comportement par défaut)

  // Bluff: parfois, on décide de jouer agressif même avec une main faible
  let bluffMultiplier = 1.0;
  if (limitMode === 'fixedlimit') bluffMultiplier = 1.5; // bluff moins cher en fixed
  const bluffTrigger = t.bluffFreq * (1 - handStrength) * (toCall === 0 ? 1.2 : 0.8) * bluffMultiplier;
  const isBluffing = Math.random() < bluffTrigger;

  return {
    adjustedStrength: adjusted,
    foldThreshold,
    raiseThreshold,
    isBluffing,
  };
}

// Détermine le sizing de relance selon la personnalité
function npcRaiseSizing(handStrength, currentBet, minRaise, pot, remainingChips, traits, npcId) {
  const potSize = pot + currentBet;
  const allInTotal = currentBet + remainingChips;
  let multiplier;

  switch (npcId) {
    case 'le_roc':
      multiplier = 2.0 + handStrength * 0.5;
      break;
    case 'le_requin':
      multiplier = 2.5 + handStrength * 1.5;
      break;
    case 'le_gambler':
      if (Math.random() < 0.3) return allInTotal; // tapis!
      multiplier = 3.0 + Math.random() * 3.0;
      break;
    case 'le_professeur':
      multiplier = 1.0 + handStrength * 1.5;
      break;
    case 'le_poisson':
      multiplier = 1.0 + Math.random() * 0.5;
      break;
    case 'l_artiste':
      if (Math.random() < 0.4) return allInTotal; // tapis surprise
      multiplier = 1.5 + Math.random() * 4.0;
      break;
    default:
      multiplier = 2.0 + handStrength;
  }

  const raiseTotal = Math.max(
    currentBet + minRaise,
    Math.floor(currentBet * multiplier)
  );
  return Math.min(raiseTotal, remainingChips + currentBet); // cap à all-in
}

// --- Fonction principale de décision PNJ ---
// Retourne { action: 'fold'|'check'|'call'|'raise', amount?: number }
// `state` est l'objet state global du jeu
function npcDecide(player, state) {
  const traits = player.npcTraits;
  const toCall = state.currentBet - player.currentBet;
  const pot = state.pot + state.players.reduce((s, p) => s + p.currentBet, 0);
  const isPreflop = state.phase === 'preflop';
  const canCheck = toCall === 0;

  // 1. Évaluer la force de la main
  const handStrength = isPreflop
    ? preflopStrength(player.holeCards[0], player.holeCards[1])
    : postflopStrength(player.holeCards, state.communityCards);

  // 2. Cotes du pot
  const potOdds = calculatePotOdds(toCall, pot);

  // 3. Appliquer la personnalité (adaptée au mode de limite)
  const decision = applyPersonality(handStrength, toCall, pot, traits, isPreflop, state.limitMode || 'nolimit');

  // 4. Déterminer l'action
  const effectiveStrength = decision.isBluffing
    ? Math.max(decision.raiseThreshold + 0.05, handStrength + 0.3)
    : decision.adjustedStrength;

  let action, amount;

  // Cas spécial: tapis automatique si les jetons sont très bas
  const shortStackPressure = player.chips < state.bigBlind * 5;
  const desperateAllIn = shortStackPressure && effectiveStrength > 0.4 && Math.random() < traits.aggression;
  // Si le call seul est déjà un all-in (ou plus), on ne relance pas — on fold ou call
  const callIsAllIn = toCall >= player.chips;

  if (callIsAllIn) {
    // Peut juste suivre (all-in) ou folder
    if (effectiveStrength < decision.foldThreshold + 0.15) {
      action = 'fold';
    } else {
      action = 'call';
    }
  } else if (desperateAllIn) {
    action = 'raise';
    amount = player.currentBet + player.chips; // total all-in
  } else if (effectiveStrength < decision.foldThreshold && !canCheck) {
    action = 'fold';
  } else if (effectiveStrength > decision.raiseThreshold) {
    action = 'raise';
    // Fixed Limit: montant fixe
    if (state.limitMode === 'fixedlimit') {
      amount = typeof getFixedLimitBet === 'function' ? state.currentBet + getFixedLimitBet() : state.currentBet + state.bigBlind;
      // Cap à 4 mises
      if (state.roundRaiseCount >= 4) {
        action = toCall > 0 ? 'call' : 'check';
      }
    } else {
      amount = npcRaiseSizing(
        handStrength,
        state.currentBet,
        state.minRaise,
        pot,
        player.chips,
        traits,
        player.npcId
      );
      // Pot-Limit: plafonner la relance à la taille du pot
      if (state.limitMode === 'potlimit') {
        const maxTotal = player.currentBet + pot + 2 * toCall;
        if (amount > maxTotal) amount = maxTotal;
      }
    }

    // S'assurer que le montant est valide (au moins la relance minimum)
    const minTotal = state.currentBet + (state.limitMode === 'fixedlimit' ? getFixedLimitBet() : state.minRaise);
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

  // Log de la décision (pour le panneau de log)
  const thought = decision.isBluffing ? ' [BLUFF!]' : '';
  const strengthPct = Math.round(handStrength * 100);
  if (!window._npcSilentMode) {
    addLog(`  🤖 ${player.name} (${player.npcName}): main ~${strengthPct}%, ${action}${thought}`);
  }

  // Catchphrase occasionnelle (15% de chance sur une relance ou un fold audacieux)
  const template = NPC_TEMPLATES.find(t => t.id === player.npcId);
  if (template && template.catchphrase && (action === 'raise' || (action === 'fold' && toCall > 0 && handStrength > 0.3))) {
    if (Math.random() < 0.15) {
      addLog(`  💬 ${player.name} : « ${template.catchphrase} »`);
    }
  }

  return { action, amount };
}

// --- Délai de réflexion du PNJ ---
function npcThinkDelay(player) {
  const template = NPC_TEMPLATES.find(t => t.id === player.npcId);
  const baseSpeed = template ? template.speed : 1000;
  // ±30% de variation aléatoire pour le réalisme
  return baseSpeed + (Math.random() - 0.5) * baseSpeed * 0.6;
}
