// ============================================================
// SIMULATION HEADLESS — Texas Hold'em Poker
// Joue des milliers de mains avec decisions aléatoires
// pour détecter des bugs d'état ou de logique.
// ============================================================

const SUITS = ['s','h','d','c'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
const PLAYER_NAMES = ['Alice','Bob','Charlie','Diane','Eve','Frank','Grace','Hugo'];

let totalHands = 0;
let errors = [];
let warnings = [];

function logError(msg, ctx) {
  errors.push({ msg, ctx: JSON.stringify(ctx), hand: totalHands });
}

function logWarn(msg, ctx) {
  warnings.push({ msg, ctx: JSON.stringify(ctx), hand: totalHands });
}

// --- Deck ---
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, value: RANK_VALUES[rank] });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Hand Evaluation ---
function get5CardCombinations(cards) {
  const combos = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return combos;
}

function evaluate5(cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const freq = {};
  for (const v of values) freq[v] = (freq[v] || 0) + 1;
  const groups = Object.entries(freq)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  let type, ranks;

  if (isFlush && isStraight) {
    type = 8;
    ranks = straightHigh === 5 ? [5,4,3,2,1] : [straightHigh, straightHigh-1, straightHigh-2, straightHigh-3, straightHigh-4];
  } else if (groups[0].count === 4) {
    type = 7;
    ranks = [groups[0].val, groups[0].val, groups[0].val, groups[0].val, groups[1].val];
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    type = 6;
    ranks = [groups[0].val, groups[0].val, groups[0].val, groups[1].val, groups[1].val];
  } else if (isFlush) {
    type = 5;
    ranks = values;
  } else if (isStraight) {
    type = 4;
    ranks = straightHigh === 5 ? [5,4,3,2,1] : [straightHigh, straightHigh-1, straightHigh-2, straightHigh-3, straightHigh-4];
  } else if (groups[0].count === 3) {
    type = 3;
    const trip = groups[0].val;
    const kickers = values.filter(v => v !== trip).sort((a,b) => b-a);
    ranks = [trip, trip, trip, kickers[0], kickers[1]];
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    type = 2;
    const hi = Math.max(groups[0].val, groups[1].val);
    const lo = Math.min(groups[0].val, groups[1].val);
    const kicker = groups[2].val;
    ranks = [hi, hi, lo, lo, kicker];
  } else if (groups[0].count === 2) {
    type = 1;
    const pair = groups[0].val;
    const kickers = values.filter(v => v !== pair).sort((a,b) => b-a);
    ranks = [pair, pair, kickers[0], kickers[1], kickers[2]];
  } else {
    type = 0;
    ranks = values;
  }

  const BASE = 13;
  let encoded = type * Math.pow(BASE, 5);
  for (let i = 0; i < 5; i++) {
    encoded += (ranks[i] - 1) * Math.pow(BASE, 4 - i);
  }
  return { type, ranks, value: encoded };
}

function evaluateHand(cards) {
  if (cards.length < 5) return null;
  const combos = get5CardCombinations(cards);
  let best = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || result.value > best.value) best = result;
  }
  return best;
}

// --- Game Simulation ---
function createPlayer(name, chips) {
  return {
    id: Math.random(),
    name,
    chips,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    isAllIn: false,
  };
}

function simulateGame(numPlayers, smallBlind, bigBlind, startingChips, maxHands) {
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(createPlayer(PLAYER_NAMES[i] || `P${i+1}`, startingChips));
  }

  let dealerIndex = Math.floor(Math.random() * numPlayers);
  const initialTotalChips = numPlayers * startingChips;

  for (let handNum = 0; handNum < maxHands; handNum++) {
    totalHands++;

    // Vérifier fin de partie
    const playersWithChips = players.filter(p => p.chips > 0);
    if (playersWithChips.length <= 1) break;

    // Vérifier invariant: somme des jetons
    const totalChips = players.reduce((s, p) => s + p.chips, 0);
    if (totalChips !== initialTotalChips) {
      logError(`Chip conservation violated: ${totalChips} vs ${initialTotalChips}`, { handNum });
    }

    // Reset hand state
    const communityCards = [];
    let pot = 0;
    let currentBet = 0;
    let minRaise = bigBlind;
    let phase = 'preflop';
    const playersActed = new Set();
    const deck = shuffle(createDeck());

    // Reset players
    players.forEach(p => {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.folded = false;
      p.isAllIn = false;
      if (p.chips === 0) {
        // Éliminé — ne peut pas participer
      }
    });

    const activePlayers = players.filter(p => p.chips > 0);
    if (activePlayers.length <= 1) break;

    // Deal hole cards
    for (let round = 0; round < 2; round++) {
      for (const p of players) {
        if (p.chips > 0) p.holeCards.push(deck.pop());
      }
    }

    // Post blinds
    const n = players.length;
    function postBlinds() {
      const sbIndex = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
      const bbIndex = n === 2 ? (dealerIndex + 1) % n : (dealerIndex + 2) % n;

      const sbPlayer = players[sbIndex];
      const bbPlayer = players[bbIndex];

      if (sbPlayer.chips > 0) {
        const sbAmount = Math.min(smallBlind, sbPlayer.chips);
        sbPlayer.chips -= sbAmount;
        sbPlayer.currentBet = sbAmount;
        if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;
      }
      if (bbPlayer.chips > 0) {
        const bbAmount = Math.min(bigBlind, bbPlayer.chips);
        bbPlayer.chips -= bbAmount;
        bbPlayer.currentBet = bbAmount;
        currentBet = bbAmount;
        if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
      }
    }
    postBlinds();

    // Game phases
    for (let phaseIdx = 0; phaseIdx < 4; phaseIdx++) {
      // Determine first to act
      let currentPlayerIndex;
      if (phase === 'preflop') {
        currentPlayerIndex = n === 2 ? dealerIndex : (dealerIndex + 3) % n;
      } else {
        currentPlayerIndex = (dealerIndex + 1) % n;
      }

      // Reset betting round state
      playersActed.clear();
      if (phase !== 'preflop') {
        currentBet = 0;
        minRaise = bigBlind;
        players.forEach(p => { p.currentBet = 0; });
      }

      // Betting round
      let safetyCounter = 0;
      const MAX_ACTIONS = 200;

      while (true) {
        safetyCounter++;
        if (safetyCounter > MAX_ACTIONS) {
          logError(`Infinite loop in betting round`, { phase, handNum });
          break;
        }

        const activeNotAllIn = players.filter(p => !p.folded && !p.isAllIn && p.chips > 0);
        if (activeNotAllIn.length === 0) break;

        // Check if round complete
        let roundComplete = true;
        for (const p of activeNotAllIn) {
          if (!playersActed.has(p.id)) { roundComplete = false; break; }
          if (p.currentBet !== currentBet) { roundComplete = false; break; }
        }
        if (roundComplete) break;

        // Find current player
        let cp = players[currentPlayerIndex];
        let found = false;
        for (let i = 0; i < n; i++) {
          const idx = (currentPlayerIndex + i) % n;
          const p = players[idx];
          if (!p.folded && !p.isAllIn && p.chips > 0) {
            cp = p;
            currentPlayerIndex = idx;
            found = true;
            break;
          }
        }
        if (!found) break;

        // Skip if already acted and no raise
        if (playersActed.has(cp.id) && cp.currentBet === currentBet) {
          currentPlayerIndex = (currentPlayerIndex + 1) % n;
          continue;
        }

        // Make random decision
        const toCall = currentBet - cp.currentBet;
        const canCheck = toCall === 0;

        let action;
        const rand = Math.random();

        if (canCheck && rand < 0.15) {
          action = 'check';
        } else if (rand < 0.25) {
          action = 'fold';
        } else if (rand < 0.80) {
          action = 'call';
        } else {
          action = 'raise';
        }

        // Apply action
        playersActed.add(cp.id);

        switch (action) {
          case 'fold':
            cp.folded = true;
            break;

          case 'check':
            // Nothing to add
            break;

          case 'call': {
            if (toCall >= cp.chips) {
              cp.currentBet += cp.chips;
              cp.chips = 0;
              cp.isAllIn = true;
            } else {
              cp.chips -= toCall;
              cp.currentBet += toCall;
            }
            break;
          }

          case 'raise': {
            if (cp.chips <= toCall) {
              // Not enough to raise, fall back to call
              if (toCall >= cp.chips) {
                cp.currentBet += cp.chips;
                cp.chips = 0;
                cp.isAllIn = true;
              } else {
                cp.chips -= toCall;
                cp.currentBet += toCall;
              }
              break;
            }

            // Random raise amount
            const minTotal = currentBet + minRaise;
            const maxTotal = Math.min(cp.chips + cp.currentBet, currentBet + cp.chips);
            const raiseTotal = minTotal + Math.floor(Math.random() * Math.max(1, maxTotal - minTotal + 1));
            const raiseBy = raiseTotal - currentBet;

            if (raiseBy >= minRaise && raiseBy <= cp.chips + cp.currentBet - currentBet) {
              const totalAdded = raiseTotal - cp.currentBet;
              cp.chips -= totalAdded;
              cp.currentBet = raiseTotal;
              currentBet = raiseTotal;
              minRaise = raiseBy;
              if (cp.chips === 0) cp.isAllIn = true;
              // Reset acted set
              playersActed.clear();
              playersActed.add(cp.id);
            } else {
              // Fallback to call
              if (toCall >= cp.chips) {
                cp.currentBet += cp.chips;
                cp.chips = 0;
                cp.isAllIn = true;
              } else {
                cp.chips -= toCall;
                cp.currentBet += toCall;
              }
            }
            break;
          }
        }

        currentPlayerIndex = (currentPlayerIndex + 1) % n;

        // Check if only one left
        const remaining = players.filter(p => !p.folded);
        if (remaining.length <= 1) break;
      }

      // Collect bets into pot
      for (const p of players) {
        pot += p.currentBet;
        p.totalBetThisHand += p.currentBet;
        p.currentBet = 0;
      }
      currentBet = 0;

      // Check if hand over
      const remaining = players.filter(p => !p.folded);
      if (remaining.length <= 1) {
        // Award pot to last remaining
        pot += players.reduce((s, p) => s + p.currentBet, 0);
        players.forEach(p => { p.currentBet = 0; });
        remaining[0].chips += pot;
        pot = 0;
        phase = 'done';
        break;
      }

      // Advance phase
      if (phase === 'preflop') {
        phase = 'flop';
        deck.pop(); // burn
        communityCards.push(deck.pop(), deck.pop(), deck.pop());
      } else if (phase === 'flop') {
        phase = 'turn';
        deck.pop();
        communityCards.push(deck.pop());
      } else if (phase === 'turn') {
        phase = 'river';
        deck.pop();
        communityCards.push(deck.pop());
      } else if (phase === 'river') {
        phase = 'showdown';
        break; // Go to showdown
      }
    }

    // Showdown
    if (phase === 'showdown') {
      const remaining = players.filter(p => !p.folded);
      if (remaining.length >= 2) {
        // Side pots : tous les niveaux, fusion des pots sans éligible
        const allInPlayers = players.filter(p => p.totalBetThisHand > 0);
        const nonFoldedBettors = allInPlayers.filter(p => !p.folded);
        const allLevels = [...new Set(allInPlayers.map(p => p.totalBetThisHand))].sort((a, b) => a - b);

        let previousLevel = 0;
        let pendingAmount = 0;
        const sidePots = [];

        for (const level of allLevels) {
          const increment = level - previousLevel;
          const contributors = allInPlayers.filter(p => p.totalBetThisHand >= level);
          const potAmount = increment * contributors.length;
          const eligible = nonFoldedBettors.filter(p => p.totalBetThisHand >= level);

          if (eligible.length > 0) {
            sidePots.push({ amount: potAmount + pendingAmount, eligible });
            pendingAmount = 0;
          } else if (sidePots.length > 0) {
            sidePots[sidePots.length - 1].amount += potAmount;
          } else {
            pendingAmount += potAmount;
          }
          previousLevel = level;
        }
        if (pendingAmount > 0) {
          if (sidePots.length > 0) {
            sidePots[sidePots.length - 1].amount += pendingAmount;
          } else if (nonFoldedBettors.length > 0 || remaining.length > 0) {
            // Aucun pot créé mais joueurs non-couchés : créer un pot
            const eligible = nonFoldedBettors.length > 0 ? nonFoldedBettors : remaining;
            sidePots.push({ amount: pendingAmount, eligible });
          }
        }

        for (const sp of sidePots) {
          if (sp.eligible.length > 0) {
            let bestValue = -1;
            let winners = [];
            for (const p of sp.eligible) {
              const allCards = [...p.holeCards, ...communityCards];
              const hand = evaluateHand(allCards);
              if (!hand) continue;
              if (hand.value > bestValue) { bestValue = hand.value; winners = [p]; }
              else if (hand.value === bestValue) winners.push(p);
            }

            if (winners.length > 0) {
              const split = Math.floor(sp.amount / winners.length);
              const remainder = sp.amount - split * winners.length;
              winners.forEach((w, i) => { w.chips += split + (i === 0 ? remainder : 0); });
            }
          }
        }
      }

      // Les side pots ont déjà redistribué tous les jetons aux gagnants
      // On vérifie juste la cohérence et on vide le pot
      const sidePotTotal = players
        .filter(p => p.totalBetThisHand > 0)
        .reduce((s, p) => { /* déjà distribué */ return s; }, 0);
      pot = 0;
    }

    // Rotate dealer
    dealerIndex = (dealerIndex + 1) % n;

    // Vérifier conservation des jetons après chaque main
    const postHandChips = players.reduce((s, p) => s + p.chips, 0);
    if (postHandChips !== initialTotalChips) {
      const details = players.map(p => `${p.name}:${p.chips}`).join(' ');
      logError(`Post-hand chip loss: ${postHandChips} vs ${initialTotalChips} (lost ${initialTotalChips - postHandChips})`, { handNum, players: details, phase });
    }
  }

  // Final chip check
  const finalChips = players.reduce((s, p) => s + p.chips, 0);
  if (finalChips !== initialTotalChips) {
    logError(`Final chip conservation violated: ${finalChips} vs ${initialTotalChips}`, {});
  }

  return { players, errors, warnings };
}

// --- Verification Tests ---
function testHandEvaluator() {
  console.log('=== Test évaluateur de mains ===');
  let passed = 0, failed = 0;

  function check(name, hole, community, expectedType) {
    const cards = [...hole, ...community];
    const result = evaluateHand(cards);
    if (!result) {
      console.log(`  FAIL ${name}: evaluation returned null`);
      failed++;
      return;
    }
    if (result.type !== expectedType) {
      console.log(`  FAIL ${name}: expected type ${expectedType}, got ${result.type}`);
      failed++;
    } else {
      passed++;
    }
  }

  function makeCard(rank, suit) {
    return { rank, suit, value: RANK_VALUES[rank] };
  }

  // Royal Flush
  check('Royal Flush',
    [makeCard('A','s'), makeCard('K','s')],
    [makeCard('Q','s'), makeCard('J','s'), makeCard('10','s'), makeCard('2','h'), makeCard('3','d')],
    8);

  // Straight Flush
  check('Straight Flush',
    [makeCard('9','h'), makeCard('8','h')],
    [makeCard('7','h'), makeCard('6','h'), makeCard('5','h'), makeCard('A','d'), makeCard('K','c')],
    8);

  // Four of a Kind
  check('Four of a Kind',
    [makeCard('K','s'), makeCard('K','h')],
    [makeCard('K','d'), makeCard('K','c'), makeCard('A','s'), makeCard('2','h'), makeCard('3','d')],
    7);

  // Full House
  check('Full House',
    [makeCard('Q','s'), makeCard('Q','h')],
    [makeCard('Q','d'), makeCard('J','c'), makeCard('J','s'), makeCard('2','h'), makeCard('3','d')],
    6);

  // Flush
  check('Flush',
    [makeCard('A','c'), makeCard('5','c')],
    [makeCard('K','c'), makeCard('10','c'), makeCard('3','c'), makeCard('2','h'), makeCard('7','d')],
    5);

  // Straight
  check('Straight',
    [makeCard('9','s'), makeCard('8','h')],
    [makeCard('7','d'), makeCard('6','c'), makeCard('5','s'), makeCard('A','h'), makeCard('K','d')],
    4);

  // Wheel (A-5 straight)
  check('Wheel Straight',
    [makeCard('A','s'), makeCard('2','h')],
    [makeCard('3','d'), makeCard('4','c'), makeCard('5','s'), makeCard('9','h'), makeCard('K','d')],
    4);

  // Three of a Kind
  check('Three of a Kind',
    [makeCard('J','s'), makeCard('J','h')],
    [makeCard('J','d'), makeCard('A','c'), makeCard('5','s'), makeCard('2','h'), makeCard('7','d')],
    3);

  // Two Pair
  check('Two Pair',
    [makeCard('10','s'), makeCard('10','h')],
    [makeCard('8','d'), makeCard('8','c'), makeCard('A','s'), makeCard('2','h'), makeCard('3','d')],
    2);

  // One Pair
  check('One Pair',
    [makeCard('7','s'), makeCard('7','h')],
    [makeCard('A','d'), makeCard('K','c'), makeCard('5','s'), makeCard('2','h'), makeCard('3','d')],
    1);

  // High Card
  check('High Card',
    [makeCard('A','s'), makeCard('K','h')],
    [makeCard('9','d'), makeCard('7','c'), makeCard('5','s'), makeCard('2','h'), makeCard('3','d')],
    0);

  console.log(`  ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function testHandComparison() {
  console.log('\n=== Test comparaison de mains ===');
  let passed = 0, failed = 0;

  function makeCard(rank, suit) {
    return { rank, suit, value: RANK_VALUES[rank] };
  }

  function compare(hole1, hole2, community, expectedWinner) {
    const h1 = evaluateHand([...hole1, ...community]);
    const h2 = evaluateHand([...hole2, ...community]);
    if (!h1 || !h2) { failed++; return; }
    const winner = h1.value > h2.value ? 1 : h1.value < h2.value ? 2 : 0;
    if (winner === expectedWinner) passed++;
    else {
      console.log(`  FAIL: expected ${expectedWinner}, got ${winner} (v1=${h1.value}, v2=${h2.value})`);
      failed++;
    }
  }

  // Higher pair wins
  compare(
    [makeCard('A','s'), makeCard('K','h')],
    [makeCard('A','d'), makeCard('Q','c')],
    [makeCard('7','d'), makeCard('7','c'), makeCard('5','s'), makeCard('2','h'), makeCard('3','d')],
    1); // A kicker beats Q kicker

  // Split pot (same hand)
  compare(
    [makeCard('A','s'), makeCard('K','h')],
    [makeCard('A','d'), makeCard('K','c')],
    [makeCard('7','d'), makeCard('7','c'), makeCard('5','s'), makeCard('2','h'), makeCard('3','d')],
    0); // identical

  // Full house beats flush
  compare(
    [makeCard('7','s'), makeCard('7','h')],
    [makeCard('A','c'), makeCard('K','c')],
    [makeCard('7','d'), makeCard('K','s'), makeCard('K','d'), makeCard('3','c'), makeCard('8','c')],
    1); // Full house (7s full of Ks) beats flush

  console.log(`  ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// --- Run Simulation ---
console.log('🃏 Texas Hold\'em — Simulation headless');
console.log('====================================\n');

// Tests unitaires d'abord
const evaluatorOk = testHandEvaluator();
const comparisonOk = testHandComparison();

if (!evaluatorOk || !comparisonOk) {
  console.log('\n❌ Tests unitaires échoués — correction nécessaire avant simulation.');
  process.exit(1);
}

console.log('\n=== Simulation de parties ===');
const CONFIGS = [
  { players: 2, hands: 500 },
  { players: 3, hands: 500 },
  { players: 4, hands: 500 },
  { players: 5, hands: 400 },
  { players: 6, hands: 300 },
  { players: 8, hands: 300 },
];

let totalErrors = 0;
let totalWarnings = 0;
let totalSimulatedHands = 0;

for (const cfg of CONFIGS) {
  const result = simulateGame(cfg.players, 10, 20, 1000, cfg.hands);
  totalSimulatedHands += totalHands;
  totalHands = 0;
  totalErrors += result.errors.length;
  totalWarnings += result.warnings.length;

  const status = result.errors.length === 0 ? '✅' : '❌';
  console.log(`  ${status} ${cfg.players} joueurs × ${cfg.hands} mains : ${result.errors.length} erreurs, ${result.warnings.length} warnings`);

  if (result.errors.length > 0) {
    for (const err of result.errors.slice(0, 5)) {
      console.log(`    ❌ [main ${err.hand}] ${err.msg}`);
    }
  }
}

console.log(`\n📊 Total : ${totalSimulatedHands} mains simulées`);
console.log(`   Erreurs  : ${totalErrors}`);
console.log(`   Warnings : ${totalWarnings}`);

if (totalErrors === 0) {
  console.log('\n✅ Aucun bug détecté !');
} else {
  console.log('\n❌ Bugs détectés — voir détails ci-dessus.');
}

process.exit(totalErrors > 0 ? 1 : 0);
