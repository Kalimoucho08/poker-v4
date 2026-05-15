// ============================================================
// TEXAS HOLD'EM POKER — Moteur de jeu complet
// ============================================================

// --- Constantes ---
const SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const SUIT_IS_RED = { s: false, h: true, d: true, c: false };
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

const HAND_TYPES = [
  'Carte haute',        // 0
  'Paire',              // 1
  'Deux paires',        // 2
  'Brelan',             // 3
  'Quinte',             // 4
  'Couleur',            // 5
  'Full',               // 6
  'Carré',              // 7
  'Quinte flush',       // 8
];

const PLAYER_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

// --- État du jeu ---
const state = {
  players: [],
  communityCards: [],
  deck: [],
  pot: 0,
  dealerIndex: 0,
  currentPlayerIndex: -1,
  phase: 'setup',           // setup | preflop | flop | turn | river | showdown
  currentBet: 0,
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 1000,
  handNumber: 0,
  playersActed: new Set(),
  minRaise: 20,
  roundRaiseCount: 0,
  awaitingAction: false,
  limitMode: 'nolimit',     // 'nolimit' | 'potlimit' | 'fixedlimit'
  soloHumanMode: false,     // true si un seul joueur humain
  handHistory: [],          // V5: historique pour détection bad beat / tilt
  _gameOver: false,         // false|'lastHand'|'summary' — handler next-hand-btn
  _lastShowdownHTML: '',     // HTML du dernier showdown à préserver dans endGame
};

// --- Utilitaires Deck ---
function createDeck() {
  const deck = [];
  for (const suit of Object.keys(SUITS)) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, value: RANK_VALUES[rank] });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Évaluation des mains ---

// Retourne les 21 combinaisons de 5 cartes parmi 7
function get5CardCombinations(cards) {
  const combos = [];
  const n = cards.length; // 7
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return combos;
}

// Évalue une main de 5 cartes et retourne { type, ranks (5 rangs ordonnés pour comparaison) }
function evaluate5(cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Vérifier quinte
  let isStraight = false;
  let straightHigh = 0;
  // Quinte normale
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Quinte à l'As (A-2-3-4-5) : l'As vaut 1
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5; // La quinte 5-high
  }

  // Compter les fréquences
  const freq = {};
  for (const v of values) freq[v] = (freq[v] || 0) + 1;
  const groups = Object.entries(freq)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  let type, ranks;

  if (isFlush && isStraight) {
    type = 8; // Quinte flush
    ranks = straightHigh === 5 ? [5,4,3,2,1] : [straightHigh, straightHigh-1, straightHigh-2, straightHigh-3, straightHigh-4];
  } else if (groups[0].count === 4) {
    type = 7; // Carré
    const quad = groups[0].val;
    const kicker = groups[1].val;
    ranks = [quad, quad, quad, quad, kicker];
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    type = 6; // Full
    ranks = [groups[0].val, groups[0].val, groups[0].val, groups[1].val, groups[1].val];
  } else if (isFlush) {
    type = 5; // Couleur
    ranks = values;
  } else if (isStraight) {
    type = 4; // Quinte
    ranks = straightHigh === 5 ? [5,4,3,2,1] : [straightHigh, straightHigh-1, straightHigh-2, straightHigh-3, straightHigh-4];
  } else if (groups[0].count === 3) {
    type = 3; // Brelan
    const trip = groups[0].val;
    const kickers = values.filter(v => v !== trip).sort((a,b) => b-a);
    ranks = [trip, trip, trip, kickers[0], kickers[1]];
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    type = 2; // Deux paires
    const hi = Math.max(groups[0].val, groups[1].val);
    const lo = Math.min(groups[0].val, groups[1].val);
    const kicker = groups[2].val;
    ranks = [hi, hi, lo, lo, kicker];
  } else if (groups[0].count === 2) {
    type = 1; // Paire
    const pair = groups[0].val;
    const kickers = values.filter(v => v !== pair).sort((a,b) => b-a);
    ranks = [pair, pair, kickers[0], kickers[1], kickers[2]];
  } else {
    type = 0; // Carte haute
    ranks = values;
  }

  // Encodage en valeur numérique unique pour comparaison
  // handType * 13^5 + ranks encodés en base 13
  const BASE = 13;
  let encoded = type * Math.pow(BASE, 5);
  for (let i = 0; i < 5; i++) {
    encoded += (ranks[i] - 1) * Math.pow(BASE, 4 - i);
  }

  return { type, ranks, value: encoded };
}

// Évalue la meilleure main parmi 7 cartes
// Retourne { type, ranks, value, bestCards, desc }
function evaluateHand(cards) {
  if (cards.length < 5) return null;
  const combos = get5CardCombinations(cards);
  let best = null;
  let bestCombo = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || result.value > best.value) {
      best = result;
      bestCombo = combo;
    }
  }
  best.bestCards = bestCombo.map(c => ({ ...c })); // shallow copy
  best.desc = handDescription(best, bestCombo);
  return best;
}

// Génère une description textuelle de la main
function handDescription(hand, cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);

  const rankName = (v) => {
    const map = { 14:'A', 13:'K', 12:'Q', 11:'J', 10:'10', 9:'9', 8:'8', 7:'7', 6:'6', 5:'5', 4:'4', 3:'3', 2:'2' };
    return map[v] || String(v);
  };

  const freq = {};
  for (const v of values) freq[v] = (freq[v] || 0) + 1;
  const groups = Object.entries(freq)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  switch (hand.type) {
    case 8: return rankName(hand.ranks[0]) === '5'
      ? `Quinte flush au 5 (${cards.map(c => rankName(c.value)).join('-')})`
      : `Quinte flush au ${rankName(hand.ranks[0])}`;
    case 7: return `Carré de ${rankName(groups[0].val)}`;
    case 6: return `Full aux ${rankName(groups[0].val)} par les ${rankName(groups[1].val)}`;
    case 5: return `Couleur ${SUITS[suits[0]]} hauteur ${rankName(hand.ranks[0])}`;
    case 4: return hand.ranks[0] === 5
      ? 'Quinte au 5 (As-2-3-4-5)'
      : `Quinte au ${rankName(hand.ranks[0])}`;
    case 3: return `Brelan de ${rankName(groups[0].val)}`;
    case 2: return `Deux paires ${rankName(groups[0].val)} et ${rankName(groups[1].val)}`;
    case 1: return `Paire de ${rankName(groups[0].val)}`;
    case 0: return `Carte haute ${rankName(hand.ranks[0])}`;
    default: return 'Main inconnue';
  }
}

function getHandName(type) {
  return HAND_TYPES[type] || 'Inconnu';
}

// --- Helpers UI Cartes ---
function suitSymbol(suit) {
  return SUITS[suit];
}

function isRed(suit) {
  return SUIT_IS_RED[suit];
}

function createCardHTML(card, faceDown = false, small = false, extraClass = '') {
  if (faceDown) {
    const size = small ? 'width:44px;height:62px' : 'width:56px;height:80px';
    return `<div class="card card-back ${extraClass}" style="${size}"></div>`;
  }
  const red = isRed(card.suit) ? ' red' : '';
  const size = small ? 'width:44px;height:62px' : 'width:56px;height:80px';
  const rankSize = small ? 'font-size:11px;top:2px;left:3px' : 'font-size:14px;top:3px;left:5px';
  const suitSize = small ? 'font-size:18px' : 'font-size:26px';
  return `<div class="card card-front${red} ${extraClass}" style="${size}">
    <span class="card-rank" style="${rankSize}">${card.rank}</span>
    <span class="card-suit-center" style="${suitSize}">${suitSymbol(card.suit)}</span>
  </div>`;
}

// --- Gestion des joueurs (setup) ---
let nextPlayerId = 0;

var anonymousMode = false; // mode anonyme : noms génériques, archétypes cachés

function addPlayer(name, isNPC = false, npcData = null) {
  if (!name.trim()) return false;
  if (state.players.length >= 8) return false;

  // Mode anonyme : nom générique pour les PNJ
  let displayName = name.trim();
  let npcName = npcData ? npcData.name : null;
  let npcEmoji = npcData ? npcData.emoji : null;

  if (isNPC && npcData && anonymousMode) {
    const letter = String.fromCharCode(65 + state.players.length); // A, B, C...
    displayName = `Joueur ${letter}`;
  }

  state.players.push({
    id: nextPlayerId++,
    name: displayName,
    chips: state.startingChips,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    isAllIn: false,
    color: isNPC && npcData ? npcData.color : PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
    isNPC,
    npcId: npcData ? npcData.id : null,
    npcName: npcData ? npcData.name : null,       // nom réel stocké (affiché dans les logs)
    npcTraits: npcData ? npcData.traits : null,
    npcEmoji: npcData ? npcData.emoji : null,
    _anonymousName: isNPC && npcData && anonymousMode ? displayName : null,
  });
  return true;
}

function removePlayer(id) {
  state.players = state.players.filter(p => p.id !== id);
}

// --- Log ---
const logEntries = [];

function addLog(msg) {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logEntries.push({ time, msg });
  renderLog();
}

// --- Rendu UI ---

function renderSetup() {
  const list = document.getElementById('player-list');
  list.innerHTML = state.players.map(p => `
    <li>
      <span><span class="player-color-dot" style="background:${p.color}"></span>${p.isNPC ? '🤖 ' : '👤 '}${p.name}${(!anonymousMode && p.isNPC && p.npcName) ? ` <small style="color:#888">(${p.npcName})</small>` : (anonymousMode && p.isNPC ? ' <small class="npc-name-generic">(style inconnu)</small>' : '')}</span>
      <button class="remove-player" data-id="${p.id}" title="Retirer">✕</button>
    </span></li>
  `).join('');

  document.getElementById('player-count-msg').textContent =
    state.players.length < 2 ? 'Minimum 2 joueurs requis' : `${state.players.length} joueur(s) prêts`;

  document.getElementById('start-game-btn').disabled = state.players.length < 2;

  // Event listeners pour les boutons de suppression
  list.querySelectorAll('.remove-player').forEach(btn => {
    btn.addEventListener('click', () => {
      removePlayer(parseInt(btn.dataset.id));
      renderSetup();
    });
  });
}

function getSeatPosition(index, total) {
  const table = document.querySelector('.poker-table');
  if (!table) return { x: 50, y: 50 };
  const rect = table.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const rx = rect.width / 2 - 80;
  const ry = rect.height / 2 - 60;

  // Positionner les joueurs en arc autour de la table
  // Le bas de la table est "devant", on laisse un espace en bas
  if (total <= 2) {
    // 2 joueurs : haut et bas
    const positions = [
      { angle: Math.PI * 0.5 },   // bas
      { angle: Math.PI * 1.5 },   // haut
    ];
    const angle = positions[index].angle;
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  }

  // 3+ joueurs : répartis autour de l'ovale, en sautant le bas-centre
  const startAngle = Math.PI * 0.65; // Commencer légèrement à droite du bas
  const endAngle = Math.PI * 2.35;   // Finir légèrement à gauche du bas
  const range = endAngle - startAngle;
  const step = range / Math.max(total, 1);

  const angle = startAngle + index * step;
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

// Retourne { sb, bb } — les indices des joueurs aux blinds (parmi les actifs)
function getBlindPositions() {
  const n = state.players.length;
  const active = state.players.filter(p => p.chips > 0);
  if (active.length < 2) return { sb: -1, bb: -1 };

  if (active.length === 2) {
    // Heads-up : dealer=SB, l'autre=BB
    const sb = state.dealerIndex;
    const bb = state.players.findIndex((p, i) => i !== sb && p.chips > 0);
    return { sb, bb };
  }

  // 3+ joueurs : SB = dealer+1, BB = dealer+2 (premiers actifs après le dealer)
  let sb = -1, bb = -1;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerIndex + i) % n;
    if (state.players[idx].chips > 0) {
      if (sb === -1) { sb = idx; }
      else if (bb === -1) { bb = idx; break; }
    }
  }
  return { sb, bb };
}

function renderSeats() {
  const container = document.getElementById('seats-container');
  const activePlayers = state.players; // Tous les joueurs sont affichés
  const blinds = state.phase !== 'setup' && state.phase !== 'showdown' ? getBlindPositions() : { sb: -1, bb: -1 };

  container.innerHTML = activePlayers.map((p, i) => {
    const pos = getSeatPosition(i, activePlayers.length);
    const isActive = p.id === (state.currentPlayerIndex !== -1 ? state.players[state.currentPlayerIndex]?.id : -1) && state.awaitingAction;
    const isDealer = i === state.dealerIndex;
    const isSB = i === blinds.sb;
    const isBB = i === blinds.bb;

    let statusClass = '';
    if (p.folded) statusClass = ' folded';
    else if (p.isAllIn) statusClass = ' all-in';
    else if (isActive) statusClass = ' active';

    // Cartes : visibles pour l'humain en mode solo, cachées sinon
    const showFaceUp = !p.isNPC && state.soloHumanMode;
    const useLarge = showFaceUp;
    const cardsHTML = p.holeCards.map(card => {
      return createCardHTML(card, !showFaceUp, !useLarge);
    }).join('');
    const cardsClass = useLarge ? ' player-hole-cards-large' : '';

    // Bouton "Voir mes cartes" : masqué en mode solo humain
    const showViewBtn = !p.isNPC && !state.soloHumanMode;
    const showCardsSection = p.holeCards.length > 0 && !p.folded;

    return `
      <div class="player-seat" data-player-id="${p.id}" style="left:${pos.x}px;top:${pos.y}px">
        <div class="player-info${statusClass}">
          <div class="player-name-row">
            ${isDealer ? '<span class="dealer-badge">D</span>' : ''}
            ${isSB ? '<span class="blind-badge blind-sb">SB</span>' : ''}
            ${isBB ? '<span class="blind-badge blind-bb">BB</span>' : ''}
            ${p.isNPC ? `<span class="npc-badge" title="${p.npcName}">🤖</span>` : ''}
            <span style="color:${p.color}">${p.name}</span>
          </div>
          <div class="player-chips">${p.chips} jetons</div>
          ${p.currentBet > 0 ? `<div class="player-bet">Mise: ${p.currentBet}</div>` : ''}
          ${p.folded ? '<div style="font-size:10px;color:#e74c3c">Couché</div>' : ''}
          ${p.isAllIn ? '<div style="font-size:10px;color:#e74c3c">TAPIS!</div>' : ''}
        </div>
        ${showCardsSection ? `
          <div class="player-hole-cards${cardsClass}">${cardsHTML}</div>
          ${showViewBtn ? `<button class="view-cards-btn" data-player-id="${p.id}" ${state.phase === 'showdown' ? 'disabled' : ''}>👁 Voir mes cartes</button>` : ''}
        ` : ''}
        ${p.holeCards.length > 0 && p.folded ? `
          <div class="player-hole-cards">${cardsHTML}</div>
        ` : ''}
        <div class="player-chip-stack chip-stack" id="player-stack-${p.id}"></div>
        ${p.currentBet > 0 ? `<div class="bet-stack" id="bet-stack-${p.id}"></div>` : '<div class="bet-stack" id="bet-stack-' + p.id + '"></div>'}
      </div>
    `;
  }).join('');

  // Remplir les piles de jetons des joueurs
  activePlayers.forEach(p => {
    const stack = document.getElementById(`player-stack-${p.id}`);
    if (stack) renderChipStacks(stack, p.chips, 6);
    // Pile de mise courante devant le joueur
    const betStack = document.getElementById(`bet-stack-${p.id}`);
    if (betStack && p.currentBet > 0) {
      renderChipStacks(betStack, p.currentBet, Math.min(8, Math.ceil(p.currentBet / 20)));
    }
  });

  // Event listeners pour les boutons "Voir mes cartes"
  container.querySelectorAll('.view-cards-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const playerId = parseInt(btn.dataset.playerId);
      showCardsOverlay(playerId);
    });
  });
}

function renderCommunityCards() {
  const container = document.getElementById('community-cards');
  const placeholders = 5;

  let html = '';
  for (let i = 0; i < placeholders; i++) {
    if (i < state.communityCards.length) {
      html += createCardHTML(state.communityCards[i], false, false, 'dealt');
    } else {
      html += '<div class="card-placeholder"></div>';
    }
  }
  container.innerHTML = html;
}

// Calcule le pot total (pot des rounds précédents + toutes les mises du round courant)
function computePotSize() {
  return state.pot + state.players.reduce((sum, p) => sum + p.currentBet, 0);
}

// Retourne le montant fixe pour le Fixed Limit selon la phase
function getFixedLimitBet() {
  const bb = state.bigBlind;
  return (state.phase === 'turn' || state.phase === 'river') ? bb * 2 : bb;
}

function renderActionBar() {
  const bar = document.getElementById('action-bar');
  const indicator = document.getElementById('current-player-indicator');
  const actionsDiv = document.querySelector('.action-buttons');

  // PNJ en train de "réfléchir"
  const cp = state.currentPlayerIndex >= 0 ? state.players[state.currentPlayerIndex] : null;
  if (cp && cp.isNPC && !cp.folded && !cp.isAllIn && !state.awaitingAction
      && state.phase !== 'showdown' && state.phase !== 'setup') {
    bar.classList.remove('hidden');
    if (actionsDiv) actionsDiv.classList.add('hidden');
    indicator.innerHTML = `🤖 <span class="npc-thinking" style="color:${cp.color}">${cp.name}</span> réfléchit...`;
    document.getElementById('raise-controls').classList.add('hidden');
    return;
  }

  if (!state.awaitingAction || state.phase === 'showdown' || state.phase === 'setup') {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  if (actionsDiv) actionsDiv.classList.remove('hidden');
  if (!cp) { bar.classList.add('hidden'); return; }

  indicator.innerHTML = `🎯 Au tour de <span style="color:${cp.color}">${cp.name}</span>`;

  const toCall = state.currentBet - cp.currentBet;
  const canCheck = toCall === 0;
  const checkCallBtn = document.getElementById('check-call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const raiseControls = document.getElementById('raise-controls');
  const isFixed = state.limitMode === 'fixedlimit';
  const isPotLimit = state.limitMode === 'potlimit';
  const potSize = computePotSize();
  const potLimitMax = cp.currentBet + potSize + 2 * toCall;
  const absoluteMax = cp.chips + cp.currentBet; // all-in total

  let canRaise;
  let raiseBtnIsAllIn = false; // true si le bouton Relancer affiche déjà "Tapis"
  if (isFixed) {
    // Fixed Limit: relance fixe, cap à 4 mises par tour
    const fixedBet = getFixedLimitBet();
    const raiseAmount = fixedBet;
    canRaise = cp.chips > toCall + raiseAmount && state.roundRaiseCount < 4;
    raiseBtn.textContent = canCheck ? `Miser ${fixedBet}` : `Relancer ${raiseAmount}`;
  } else {
    const minRaiseTo = state.currentBet + state.minRaise;
    const maxRaise = isPotLimit ? Math.min(potLimitMax, absoluteMax) : absoluteMax;

    // No Limit/Pot Limit: l'all-in est toujours autorisé, même en dessous du minRaise
    const canMeetMinRaise = maxRaise >= minRaiseTo;
    const allInBelowMin = cp.chips > toCall && absoluteMax < minRaiseTo;
    canRaise = cp.chips > toCall && (canMeetMinRaise || allInBelowMin);
    raiseBtnIsAllIn = allInBelowMin || (absoluteMax === maxRaise && canMeetMinRaise && cp.chips <= toCall + state.minRaise);
    raiseBtn.textContent = allInBelowMin ? 'Tapis !' : (raiseBtnIsAllIn ? 'Tapis' : 'Relancer');
  }

  // Bouton Check/Call
  if (canCheck) {
    checkCallBtn.textContent = isFixed ? 'Parole' : 'Parole';
    checkCallBtn.className = 'btn btn-action btn-check';
  } else {
    checkCallBtn.textContent = toCall >= cp.chips ? `Tapis (${cp.chips})` : `Suivre (${toCall})`;
    checkCallBtn.className = 'btn btn-action btn-check';
  }

  raiseBtn.disabled = !canRaise;
  if (raiseControls) raiseControls.classList.add('hidden');
  raiseBtn.classList.remove('hidden');

  // Bouton all-in dédié : masqué si le bouton Relancer fait déjà office de tapis
  const allinBtn = document.getElementById('allin-btn');
  if (allinBtn) {
    const showAllin = !isFixed && cp.chips > 0 && !cp.isAllIn && !raiseBtnIsAllIn;
    allinBtn.classList.toggle('hidden', !showAllin);
    if (showAllin) {
      // En Pot Limit, le tapis est impossible si le stack dépasse la mise max autorisée
      const allInBlocked = isPotLimit && absoluteMax > potLimitMax;
      allinBtn.disabled = allInBlocked;
      allinBtn.textContent = allInBlocked ? 'Tapis (bloqué)' : 'Tapis !';
    }
  }

  document.getElementById('fold-btn').classList.remove('hidden');
  checkCallBtn.classList.remove('hidden');
}

function renderPhaseLabel() {
  const labels = {
    preflop: 'Pré-flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Abattage',
  };
  document.getElementById('phase-label').textContent = labels[state.phase] || state.phase;
}

// Valeurs de jetons (décomposition par dénomination)
const CHIP_DENOMINATIONS = [
  { value: 500, color: 'chip-gold',    label: '500' },
  { value: 100, color: 'chip-purple',  label: '100' },
  { value: 25,  color: 'chip-green',   label: '25' },
  { value: 10,  color: 'chip-blue',    label: '10' },
  { value: 5,   color: 'chip-red',     label: '5' },
  { value: 1,   color: 'chip-white',   label: '1' },
];

// Décompose un montant en piles de jetons par valeur
function chipBreakdown(amount) {
  const breakdown = [];
  let remaining = amount;
  for (const denom of CHIP_DENOMINATIONS) {
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      breakdown.push({ ...denom, count: Math.min(count, 15) }); // max 15 jetons visibles par pile
      remaining -= count * denom.value;
    }
  }
  if (remaining > 0 && breakdown.length === 0) {
    // Moins de 1 jeton → en mettre au moins un
    breakdown.push({ ...CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length-1], count: 1 });
  }
  return breakdown;
}

// Affiche les piles de jetons côte à côte
function renderChipStacks(container, amount, maxStackHeight = 8) {
  const breakdown = chipBreakdown(amount);
  let html = '<div class="chip-stacks-row">';
  for (const stack of breakdown) {
    const showCount = Math.min(stack.count, maxStackHeight);
    html += `<div class="chip-denom-stack" title="${stack.count}×${stack.label}">`;
    for (let i = 0; i < showCount; i++) {
      html += `<div class="chip ${stack.color}"></div>`;
    }
    // Si plus que le max visible, afficher le compte
    if (stack.count > maxStackHeight) {
      html += `<span class="chip-count-label">×${stack.count}</span>`;
    }
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderPot() {
  const totalPot = state.pot + state.players.reduce((s, p) => s + p.currentBet, 0);
  document.getElementById('pot-display').textContent = `Pot : ${totalPot}`;
  const potStack = document.getElementById('pot-stack');
  if (potStack) renderChipStacks(potStack, totalPot, 10);
}

function renderLog() {
  const content = document.getElementById('log-content');
  content.innerHTML = logEntries.slice(-50).map(e =>
    `<div class="log-entry"><span class="time">${e.time}</span> ${e.msg}</div>`
  ).join('');
  content.scrollTop = content.scrollHeight;
}

function exportLogs() {
  if (logEntries.length === 0) {
    alert('Aucun log à exporter.');
    return;
  }
  const text = logEntries.map(e => `[${e.time}] ${e.msg}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `poker_logs_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function renderAll() {
  renderSeats();
  renderCommunityCards();
  renderActionBar();
  renderPhaseLabel();
  renderPot();
  // Rafraîchir le panneau de conseils s'il est ouvert
  const panel = document.getElementById('advice-panel');
  if (panel && !panel.classList.contains('hidden')) {
    document.getElementById('advice-content').innerHTML = generateAdvice();
  }
}

// --- Overlay des cartes ---
let cardOverlayTimer = null;

function showCardsOverlay(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.holeCards.length === 0) return;
  if (!player.isNPC && state.soloHumanMode) return; // Pas d'overlay en mode solo

  const overlay = document.getElementById('card-overlay');
  document.getElementById('overlay-player-name').textContent = `Cartes de ${player.name}`;

  const cardsContainer = document.getElementById('overlay-cards');
  cardsContainer.innerHTML = player.holeCards.map(c => createCardHTML(c, false, false)).join('');

  overlay.classList.remove('hidden');

  // Auto-hide après 5 secondes
  let timeLeft = 5;
  const timerEl = document.getElementById('overlay-timer');
  timerEl.textContent = `Dissimulation automatique dans ${timeLeft}s`;

  if (cardOverlayTimer) clearInterval(cardOverlayTimer);
  cardOverlayTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(cardOverlayTimer);
      hideCardsOverlay();
    } else {
      timerEl.textContent = `Dissimulation automatique dans ${timeLeft}s`;
    }
  }, 1000);

  addLog(`${player.name} regarde ses cartes`);
}

function hideCardsOverlay() {
  if (cardOverlayTimer) clearInterval(cardOverlayTimer);
  document.getElementById('card-overlay').classList.add('hidden');
}

// --- Logique de jeu ---

function startNewHand() {
  // Vérifier si la partie est terminée (un seul joueur avec des jetons, ou humain éliminé en solo)
  const playersWithChips = state.players.filter(p => p.chips > 0);
  const humanAlive = playersWithChips.some(p => !p.isNPC);
  if (playersWithChips.length <= 1 || (state.soloHumanMode && !humanAlive)) {
    endGame();
    return;
  }

  state._gameOver = false;
  state.handNumber++;
  state.communityCards = [];
  state.pot = 0;
  state.currentBet = 0;
  state.playersActed = new Set();
  state.roundRaiseCount = 0;

  // V5: decay du tilt pour tous les joueurs
  if (typeof decayTilt === 'function') {
    state.players.forEach(p => { if (p.isNPC) decayTilt(p.id); });
  }

  // Réinitialiser les joueurs (les éliminés restent hors-jeu)
  state.players.forEach(p => {
    p.holeCards = [];
    p.currentBet = 0;
    p.totalBetThisHand = 0;
    p.folded = p.chips <= 0;   // éliminé = déjà couché
    p.isAllIn = false;
  });

  // Créer et mélanger le deck
  state.deck = shuffle(createDeck());

  // Distribuer 2 cartes à chaque joueur actif
  const activePlayers = state.players.filter(p => p.chips > 0);
  for (let round = 0; round < 2; round++) {
    for (const player of state.players) {
      if (player.chips > 0) {
        player.holeCards.push(state.deck.pop());
      }
    }
  }

  // Détection solo humain
  const humanCount = state.players.filter(p => !p.isNPC).length;
  state.soloHumanMode = humanCount === 1;

  // Phase pré-flop
  state.phase = 'preflop';
  postBlinds();
  renderAll();
  addLog(`--- Main #${state.handNumber} (${state.limitMode === 'potlimit' ? 'Pot Limit' : state.limitMode === 'fixedlimit' ? 'Fixed Limit' : 'No Limit'}) ---`);
  addLog(`Donneur : ${state.players[state.dealerIndex].name}`);
  if (state.soloHumanMode) {
    const humanPlayer = state.players.find(p => !p.isNPC);
    addLog(`Mode solo activé — cartes de ${humanPlayer.name} visibles en permanence`);
  }

  startBettingRound();
}

// Trouve le prochain joueur actif (chips > 0) à partir d'un index
function findNextPlayerWithChips(fromIndex) {
  const n = state.players.length;
  for (let i = 0; i < n; i++) {
    const idx = (fromIndex + i) % n;
    if (state.players[idx].chips > 0) return idx;
  }
  return -1;
}

function postBlinds() {
  const n = state.players.length;
  const activePlayers = state.players.filter(p => p.chips > 0);
  const activeCount = activePlayers.length;

  if (activeCount < 2) return;

  // Trouver les joueurs pour SB et BB (en sautant les éliminés)
  const sbIndex = findNextPlayerWithChips((state.dealerIndex + 1) % n);
  if (sbIndex === -1) return;
  const bbIndex = findNextPlayerWithChips((sbIndex + 1) % n);
  if (bbIndex === -1) return;

  let sbPlayer, bbPlayer;
  if (activeCount === 2) {
    // Heads-up : dealer = SB, l'autre joueur actif = BB
    sbPlayer = state.players[state.dealerIndex];
    // Si le dealer est éliminé, prendre l'autre joueur actif
    if (sbPlayer.chips <= 0) {
      sbPlayer = activePlayers[0];
    }
    bbPlayer = activePlayers.find(p => p.id !== sbPlayer.id);
  } else {
    sbPlayer = state.players[sbIndex];
    bbPlayer = state.players[bbIndex];
  }

  // Si SB ou BB est hors jeu (0 chips), on ne poste pas
  if (sbPlayer.chips <= 0) {
    addLog(`${sbPlayer.name} est éliminé — pas de small blind`);
    return;
  }

  // Post small blind
  const sbAmount = Math.min(state.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;
  addLog(`${sbPlayer.name} poste la small blind (${sbAmount})`);

  // Post big blind
  if (bbPlayer.chips <= 0) {
    addLog(`${bbPlayer.name} est éliminé — pas de big blind`);
    state.currentBet = sbAmount;
    state.minRaise = state.bigBlind;
    return;
  }

  const bbAmount = Math.min(state.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  state.currentBet = bbAmount;
  state.minRaise = state.bigBlind;
  if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
  addLog(`${bbPlayer.name} poste la big blind (${bbAmount})`);

  // Animation : jetons des blinds vers les piles de mise
  setTimeout(() => {
    const sbStack = document.getElementById(`player-stack-${sbPlayer.id}`);
    const bbStack = document.getElementById(`player-stack-${bbPlayer.id}`);
    const potEl = document.getElementById('pot-stack');
    if (sbStack && potEl) animateChipFly(sbStack, potEl, Math.min(3, Math.ceil(sbAmount / 5)));
    if (bbStack && potEl) animateChipFly(bbStack, potEl, Math.min(4, Math.ceil(bbAmount / 5)));
  }, 200);
}

function findFirstToAct() {
  const n = state.players.length;
  const activePlayers = state.players.filter(p => p.chips > 0);
  const activeCount = activePlayers.length;

  if (activeCount === 2) {
    // Heads-up pre-flop : dealer (SB) acts first
    if (state.players[state.dealerIndex].chips > 0) return state.dealerIndex;
    // Fallback: trouver l'autre joueur actif
    for (let i = 1; i <= n; i++) {
      const idx = (state.dealerIndex + i) % n;
      if (state.players[idx].chips > 0) return idx;
    }
    return state.dealerIndex;
  }

  // 3+ joueurs : trouver d'abord la BB (dealer+2 en sautant les éliminés)
  let bbIdx = -1;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerIndex + i) % n;
    if (state.players[idx].chips > 0) {
      if (bbIdx === -1) { bbIdx = idx; continue; } // premier actif = SB
      bbIdx = idx; break; // deuxième actif = BB
    }
  }
  if (bbIdx === -1) return state.dealerIndex; // fallback

  // UTG = premier joueur actif après la BB
  for (let i = 1; i <= n; i++) {
    const idx = (bbIdx + i) % n;
    if (state.players[idx].chips > 0) return idx;
  }
  return bbIdx; // fallback (ne devrait pas arriver)
}

function findNextActivePlayer(fromIndex) {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = state.players[idx];
    if (!p.folded && !p.isAllIn && p.chips > 0) return idx;
  }
  return -1;
}

function countActivePlayers() {
  return state.players.filter(p => !p.folded && p.chips > 0).length;
}

function countPlayersWhoCanAct() {
  return state.players.filter(p => !p.folded && !p.isAllIn && p.chips > 0).length;
}

function startBettingRound() {
  // Si un seul joueur actif, fin de la main
  if (countActivePlayers() <= 1) {
    endHand();
    return;
  }

  state.playersActed = new Set();
  state.roundRaiseCount = 0;

  if (state.phase === 'preflop') {
    state.currentPlayerIndex = findFirstToAct();
    // En pré-flop, le currentBet est déjà la big blind
    // Si le premier joueur est aussi le big blind (3 joueurs), il peut checker
  } else {
    // Post-flop : commencer à gauche du dealer
    state.currentPlayerIndex = (state.dealerIndex + 1) % state.players.length;
    state.currentBet = 0;
    state.minRaise = state.bigBlind; // Réinitialiser le minimum de mise par tour
    state.players.forEach(p => { p.currentBet = 0; });
  }

  // S'assurer que le joueur courant peut agir (pas éliminé, pas couché, pas all-in)
  const cp = state.players[state.currentPlayerIndex];
  if (cp.folded || cp.isAllIn || cp.chips === 0) {
    advanceToNextPlayer();
    return;
  }

  // Si c'est un PNJ, action automatique après délai
  if (cp.isNPC) {
    state.awaitingAction = false;
    renderAll();
    setTimeout(() => npcAutoPlay(), npcThinkDelay(cp));
    return;
  }

  state.awaitingAction = true;
  renderAll();
  addLog(`C'est au tour de ${state.players[state.currentPlayerIndex].name}`);
}

function advanceToNextPlayer() {
  const next = findNextActivePlayer(state.currentPlayerIndex);
  if (next === -1 || countPlayersWhoCanAct() === 0) {
    // Plus personne ne peut agir, fin du round
    finishBettingRound();
    return;
  }

  state.currentPlayerIndex = next;
  const cp = state.players[state.currentPlayerIndex];

  // Si c'est un PNJ, action automatique après délai
  if (cp.isNPC) {
    state.awaitingAction = false;
    renderAll();
    setTimeout(() => npcAutoPlay(), npcThinkDelay(cp));
    return;
  }

  state.awaitingAction = true;
  renderAll();
  addLog(`C'est au tour de ${state.players[state.currentPlayerIndex].name}`);
}

function isBettingRoundComplete() {
  const canAct = state.players.filter(p => !p.folded && !p.isAllIn);

  // Si tout le monde est couché sauf un
  if (state.players.filter(p => !p.folded).length <= 1) return true;

  // Si personne ne peut agir
  if (canAct.length === 0) return true;

  // Tous les joueurs pouvant agir l'ont fait ET leurs mises sont égales au currentBet
  for (const p of canAct) {
    if (!state.playersActed.has(p.id)) return false;
    if (p.currentBet !== state.currentBet) return false;
  }

  return true;
}

function finishBettingRound() {
  // Animation : jetons des mises vers le pot
  const potEl = document.getElementById('pot-stack');
  if (potEl) {
    for (const p of state.players) {
      if (p.currentBet > 0) {
        const betStack = document.getElementById(`bet-stack-${p.id}`);
        if (betStack) animateChipFly(betStack, potEl, Math.min(5, Math.ceil(p.currentBet / 10)));
      }
    }
  }

  // Collecter toutes les mises dans le pot
  for (const p of state.players) {
    state.pot += p.currentBet;
    p.totalBetThisHand += p.currentBet;
    p.currentBet = 0;
  }

  state.currentBet = 0;
  state.awaitingAction = false;

  if (countActivePlayers() <= 1) {
    endHand();
    return;
  }

  advancePhase();
}

function formatCards(cards) {
  return cards.map(c => `${c.rank}${suitSymbol(c.suit)}`).join(' ');
}

function advancePhase() {
  switch (state.phase) {
    case 'preflop':
      state.phase = 'flop';
      state.deck.pop(); // burn
      state.communityCards.push(state.deck.pop());
      state.communityCards.push(state.deck.pop());
      state.communityCards.push(state.deck.pop());
      addLog(`🃏 Flop : [${formatCards(state.communityCards)}]`);
      // V5: enregistrer les joueurs qui voient le flop
      if (typeof recordSawFlop === 'function') {
        state.players.forEach(p => { if (!p.folded && p.chips > 0) recordSawFlop(p.id); });
      }
      break;
    case 'flop':
      state.phase = 'turn';
      state.deck.pop(); // burn
      state.communityCards.push(state.deck.pop());
      addLog(`🃏 Turn : [${formatCards(state.communityCards)}]`);
      break;
    case 'turn':
      state.phase = 'river';
      state.deck.pop(); // burn
      state.communityCards.push(state.deck.pop());
      addLog(`🃏 River : [${formatCards(state.communityCards)}]`);
      break;
    case 'river':
      state.phase = 'showdown';
      showdown();
      return;
  }

  state.playersActed = new Set();
  state.roundRaiseCount = 0;
  renderAll();
  startBettingRound();
}

function playerFold() {
  const cp = state.players[state.currentPlayerIndex];
  cp.folded = true;
  state.playersActed.add(cp.id);
  addLog(`${cp.name} se couche`);

  // V5: enregistrer l'action pour opponent-model
  if (typeof recordAction === 'function') {
    recordAction(cp.id, 'fold', 0, state.phase, state.phase === 'preflop');
  }

  if (countActivePlayers() <= 1) {
    // Tout le monde s'est couché sauf un
    const winner = state.players.find(p => !p.folded);
    // Collecter les mises (endHand distribuera le pot)
    for (const p of state.players) {
      state.pot += p.currentBet;
      p.totalBetThisHand += p.currentBet;
      p.currentBet = 0;
    }
    endHand();
    return;
  }

  if (isBettingRoundComplete()) {
    finishBettingRound();
  } else {
    advanceToNextPlayer();
  }
}

function playerCheckCall() {
  const cp = state.players[state.currentPlayerIndex];
  const toCall = state.currentBet - cp.currentBet;

  if (toCall === 0) {
    // Check
    addLog(`${cp.name} parole`);
  } else if (toCall >= cp.chips) {
    // All-in call
    const amount = cp.chips;
    cp.chips = 0;
    cp.currentBet += amount;
    cp.isAllIn = true;
    addLog(`${cp.name} suit et est à tapis (${amount})`);
  } else {
    // Call
    cp.chips -= toCall;
    cp.currentBet += toCall;
    addLog(`${cp.name} suit (${toCall})`);
  }

  state.playersActed.add(cp.id);

  // V5: enregistrer l'action pour opponent-model
  const callAction = toCall === 0 ? 'check' : (cp.isAllIn ? 'call' : 'call');
  if (typeof recordAction === 'function') {
    recordAction(cp.id, callAction, toCall, state.phase, state.phase === 'preflop');
  }

  if (isBettingRoundComplete()) {
    finishBettingRound();
  } else {
    advanceToNextPlayer();
  }
}

function playerRaise(amount) {
  const cp = state.players[state.currentPlayerIndex];
  const toCall = state.currentBet - cp.currentBet;
  const totalNeeded = toCall + amount;

  // All-in : si le joueur n'a pas assez, on cappe à tout son stack
  if (totalNeeded > cp.chips) {
    amount = cp.chips - toCall;
    totalNeeded = cp.chips;
    if (amount <= 0) return; // Même l'all-in ne suffit pas
  }

  // Fixed Limit: utiliser le montant fixe
  if (state.limitMode === 'fixedlimit') {
    amount = getFixedLimitBet();
    // Cap à 4 mises par tour
    if (state.roundRaiseCount >= 4) return;
  }

  // Pot-Limit: plafonner la relance (max = pot + montant à suivre)
  if (state.limitMode === 'potlimit') {
    const potSize = computePotSize();
    const maxRaiseAmount = potSize + toCall;
    if (amount > maxRaiseAmount) {
      amount = maxRaiseAmount;
    }
  }

  cp.chips -= totalNeeded;
  cp.currentBet += totalNeeded;
  state.currentBet = cp.currentBet;
  state.minRaise = amount;
  state.roundRaiseCount++;

  if (cp.chips === 0) cp.isAllIn = true;

  // Animation jetons vers le pot
  const playerStack = document.getElementById(`player-stack-${cp.id}`);
  const potStack = document.getElementById('pot-stack');
  if (playerStack && potStack) animateChipFly(playerStack, potStack, Math.min(8, Math.ceil(totalNeeded / 20)));

  // Réinitialiser les joueurs ayant agi (sauf le relanceur)
  state.playersActed = new Set([cp.id]);

  addLog(`${cp.name} relance à ${cp.currentBet} (+${amount})`);

  // V5: enregistrer l'action pour opponent-model
  if (typeof recordAction === 'function') {
    recordAction(cp.id, 'raise', amount, state.phase, state.phase === 'preflop');
  }

  if (isBettingRoundComplete()) {
    finishBettingRound();
  } else {
    advanceToNextPlayer();
  }
}

// --- PNJ : Action automatique ---
function npcAutoPlay() {
  const cp = state.players[state.currentPlayerIndex];
  if (!cp || !cp.isNPC) return;
  if (cp.folded || cp.isAllIn || cp.chips === 0) return;
  if (!cp.holeCards || cp.holeCards.length < 2) return;
  if (state.phase === 'setup' || state.phase === 'showdown') return;

  const decision = npcDecide(cp, state);

  switch (decision.action) {
    case 'fold':
      playerFold();
      break;
    case 'check':
    case 'call':
      playerCheckCall();
      break;
    case 'raise': {
      const toCall = state.currentBet - cp.currentBet;
      let raiseBy = (decision.amount || state.currentBet + state.minRaise) - state.currentBet;
      if (raiseBy <= 0 || toCall + raiseBy > cp.chips) {
        // Relance impossible → fallback sur call
        playerCheckCall();
      } else {
        playerRaise(raiseBy);
      }
      break;
    }
  }

  renderAll();
}

// --- Showdown & Pots ---

function showdown() {
  state.awaitingAction = false;
  hideCardsOverlay();

  const activePlayers = state.players.filter(p => !p.folded);
  addLog('--- Abattage ---');
  addLog(`🃏 Cartes communes : [${formatCards(state.communityCards)}]`);

  // Calculer les side pots
  const pots = calculateSidePots();

  // Pour chaque pot, déterminer le gagnant
  const results = [];
  for (const pot of pots) {
    const eligible = activePlayers.filter(p => pot.eligibleIds.includes(p.id));
    if (eligible.length === 0) continue;

    let bestValue = -1;
    let winners = [];

    for (const player of eligible) {
      const allCards = [...player.holeCards, ...state.communityCards];
      const hand = evaluateHand(allCards);
      player.bestHand = hand;

      if (hand.value > bestValue) {
        bestValue = hand.value;
        winners = [player];
      } else if (hand.value === bestValue) {
        winners.push(player);
      }
    }

    const splitAmount = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - splitAmount * winners.length;

    winners.forEach((w, i) => {
      w.chips += splitAmount + (i === 0 ? remainder : 0);
    });

    const handName = winners.length > 0 && winners[0].bestHand ? getHandName(winners[0].bestHand.type) : 'Inconnu';
    results.push({ pot: pot.amount, winners, handName });
  }

  // Afficher les résultats
  showWinnerOverlay(results, activePlayers);

  // V5: détection bad beat → alimenter le tilt
  if (typeof recordTiltEvent === 'function') {
    const allWinners = new Set();
    for (const r of results) {
      for (const w of r.winners) allWinners.add(w.id);
    }
    for (const p of activePlayers) {
      if (!p.isNPC) continue;
      const hand = p.bestHand;
      // Bad beat: main forte (flush+) qui perd
      if (hand && hand.type >= 5 && !allWinners.has(p.id)) {
        recordTiltEvent(p.id, true);
      }
      // Bad beat modéré: était devant au turn avec brelan+ et perd
      if (hand && hand.type >= 3 && !allWinners.has(p.id) && state.communityCards.length >= 4) {
        recordTiltEvent(p.id, true);
      }
    }
    // Les gagnants perdent du tilt
    for (const wId of allWinners) {
      recordTiltEvent(wId, false);
    }
  }

  // Log — mains détaillées au showdown
  for (const p of activePlayers) {
    const allCards = [...p.holeCards, ...state.communityCards];
    const hand = p.bestHand || evaluateHand(allCards);
    if (hand && hand.desc) {
      addLog(`  ${p.isNPC ? '🤖' : '👤'} ${p.name} montre : ${hand.desc} (${formatCards(p.holeCards)})`);
    }
  }
  // Log — gains (regroupés par joueur)
  const winnerTotals = {};
  for (const r of results) {
    r.winners.forEach(w => {
      winnerTotals[w.id] = (winnerTotals[w.id] || 0) + Math.floor(r.pot / r.winners.length);
    });
  }
  for (const [id, total] of Object.entries(winnerTotals)) {
    const w = state.players.find(p => p.id === parseInt(id));
    if (w) addLog(`💰 ${w.name} gagne ${total} jetons au total → stack: ${w.chips}`);
  }
  // Log — stacks de tous les joueurs
  logPlayerStacks();

  // Faire tourner le dealer
  state.dealerIndex = findNextPlayerWithChips((state.dealerIndex + 1) % state.players.length);
  state.phase = 'showdown';

  // Sauvegarder le HTML du showdown pour le préserver dans endGame
  state._lastShowdownHTML = document.getElementById('showdown-cards').innerHTML;

  // Vérifier si la partie est terminée après ce showdown
  const playersWithChips = state.players.filter(p => p.chips > 0);
  if (playersWithChips.length <= 1) {
    state._gameOver = 'lastHand';
    document.getElementById('next-hand-btn').textContent = 'Voir le résultat final ▶';
  }

  renderAll();
}

function logPlayerStacks() {
  const stacks = state.players.map(p => `${p.isNPC ? '🤖' : '👤'} ${p.name}: ${p.chips} jetons`).join(' | ');
  addLog(`📊 Stacks : ${stacks}`);
}

function calculateSidePots() {
  const allPlayers = state.players.filter(p => p.totalBetThisHand > 0);
  const nonFolded = allPlayers.filter(p => !p.folded);

  // Tous les niveaux de contribution (y compris joueurs couchés)
  const allLevels = [...new Set(allPlayers.map(p => p.totalBetThisHand))].sort((a, b) => a - b);

  const pots = [];
  let previousLevel = 0;
  let pendingAmount = 0; // Jetons sans éligible (fusionnés au prochain pot valide)

  for (const level of allLevels) {
    const increment = level - previousLevel;
    const contributors = allPlayers.filter(p => p.totalBetThisHand >= level);
    const potAmount = increment * contributors.length;

    const eligible = nonFolded.filter(p => p.totalBetThisHand >= level);

    if (eligible.length > 0) {
      pots.push({
        amount: potAmount + pendingAmount,
        eligibleIds: eligible.map(p => p.id),
        level,
      });
      pendingAmount = 0;
    } else {
      // Aucun éligible → fusionner dans le pot précédent ou garder en attente
      if (pots.length > 0) {
        pots[pots.length - 1].amount += potAmount;
      } else {
        pendingAmount += potAmount;
      }
    }
    previousLevel = level;
  }

  // S'il reste du pending sans pot
  if (pendingAmount > 0) {
    if (pots.length > 0) {
      pots[pots.length - 1].amount += pendingAmount;
    } else if (nonFolded.length > 0) {
      // Aucun pot créé mais des joueurs non-couchés : créer un pot
      pots.push({
        amount: pendingAmount,
        eligibleIds: nonFolded.map(p => p.id),
        level: previousLevel,
      });
    }
  }

  return pots;
}

function awardPot(winners, amount) {
  const split = Math.floor(amount / winners.length);
  const remainder = amount - split * winners.length;
  winners.forEach((w, i) => {
    w.chips += split + (i === 0 ? remainder : 0);
  });
}

function endHand() {
  state.awaitingAction = false;
  state.phase = 'showdown';

  let winnerName = '';
  let totalPot = state.pot + state.players.reduce((sum, p) => sum + p.currentBet, 0);

  // Donner le pot au dernier joueur restant
  const remaining = state.players.filter(p => !p.folded);
  if (remaining.length >= 1) {
    // S'il y a plusieurs joueurs encore en lice, on prend celui qui a le plus misé
    const winner = remaining.length === 1 ? remaining[0] : remaining.reduce((a, b) => a.totalBetThisHand >= b.totalBetThisHand ? a : b);
    winner.chips += totalPot;
    winnerName = winner.name;
    addLog(`💰 ${winner.name} remporte ${totalPot} jetons → stack: ${winner.chips}`);
  } else {
    winnerName = 'Personne';
  }

  // Log les stacks après la main
  logPlayerStacks();

  // Collecter les mises restantes
  for (const p of state.players) {
    state.pot += p.currentBet;
    p.currentBet = 0;
  }
  state.pot = 0;

  // Rotation du dealer
  state.dealerIndex = findNextPlayerWithChips((state.dealerIndex + 1) % state.players.length);

  renderAll();
  document.getElementById('action-bar').classList.add('hidden');

  // Vérifier la fin de partie — toujours afficher le résultat de la main d'abord
  const playersWithChips = state.players.filter(p => p.chips > 0);
  const humanAlive = playersWithChips.some(p => !p.isNPC);
  const isGameOver = playersWithChips.length <= 1 || (state.soloHumanMode && !humanAlive);

  showWinByFoldOverlay(winnerName, totalPot);
  if (isGameOver) {
    state._gameOver = 'lastHand';
    document.getElementById('next-hand-btn').textContent = 'Voir le résultat final ▶';
  }
}

// Overlay quand un joueur gagne par abandon général (sans showdown)
function showWinByFoldOverlay(winnerName, amount) {
  const overlay = document.getElementById('winner-overlay');
  const winner = state.players.find(p => p.name === winnerName);
  const losers = state.players.filter(p => p.folded && p.totalBetThisHand > 0);
  const loserNames = losers.map(p => `${p.name} (-${p.totalBetThisHand})`).join(', ');

  document.getElementById('winner-title').textContent = `${winnerName} remporte la main !`;

  // Sans showdown : pas de cartes privées révélées, seulement le board
  let html = '';
  // Cartes communes déjà tirées — flop / turn / river
  if (state.communityCards.length > 0) {
    html += `<div class="showdown-section-label">🃏 Cartes sur la table</div>`;
    html += `<div class="showdown-board">`;
    if (state.communityCards.length >= 3) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">Flop</span><div class="showdown-cards-row">${state.communityCards.slice(0, 3).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    if (state.communityCards.length >= 4) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">Turn</span><div class="showdown-cards-row">${state.communityCards.slice(3, 4).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    if (state.communityCards.length >= 5) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">River</span><div class="showdown-cards-row">${state.communityCards.slice(4, 5).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    html += `</div>`;
  } else {
    html += `<p style="color:#888;font-size:13px;margin:8px 0">(pré-flop — pas de cartes communes)</p>`;
  }
  if (loserNames) {
    html += `<p style="color:#999;font-size:12px;margin-top:12px">Abandons : ${loserNames}</p>`;
  }

  document.getElementById('showdown-cards').innerHTML = html;
  document.getElementById('winner-amount').textContent = `Pot : ${amount} jetons${winner ? ' — Stack : ' + winner.chips + ' jetons' : ''}`;
  const nextBtn = document.getElementById('next-hand-btn');
  nextBtn.textContent = 'Main suivante ▶';
  state._gameOver = false;

  // Animation jetons depuis le pot vers le gagnant
  const potStack = document.getElementById('pot-stack');
  if (winner && potStack) {
    const winnerStack = document.getElementById(`player-stack-${winner.id}`);
    if (winnerStack) setTimeout(() => animateChipFly(potStack, winnerStack, 10), 300);
  }

  const wc = overlay.querySelector('.winner-card');
  if (wc) wc.classList.add('winner-pulse');
  setTimeout(() => { if (wc) wc.classList.remove('winner-pulse'); }, 4500);

  overlay.classList.remove('hidden');
}

function nextHandFromOverlay() {
  document.getElementById('winner-overlay').classList.add('hidden');
  document.getElementById('action-bar').classList.remove('hidden');
  hideCardsOverlay();
  startNewHand();
}

function showWinnerOverlay(results, activePlayers) {
  const overlay = document.getElementById('winner-overlay');
  const title = document.getElementById('winner-title');
  const cardsDiv = document.getElementById('showdown-cards');
  const amountP = document.getElementById('winner-amount');

  // Titre
  const mainResult = results.length > 0 ? results[results.length - 1] : null;
  if (mainResult && mainResult.winners && mainResult.winners.length > 1) {
    title.textContent = `Égalité — ${mainResult.winners.map(w => w.name).join(' et ')}`;
  } else if (mainResult && mainResult.winners && mainResult.winners.length === 1) {
    title.textContent = `${mainResult.winners[0].name} remporte la main !`;
  } else {
    title.textContent = 'Main terminée';
  }

  let html = '';

  // Cartes communes — flop / turn / river, comme sur la table
  if (state.communityCards.length > 0) {
    html += `<div class="showdown-section-label">🃏 Cartes communes</div>`;
    html += `<div class="showdown-board">`;
    if (state.communityCards.length >= 3) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">Flop</span><div class="showdown-cards-row">${state.communityCards.slice(0, 3).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    if (state.communityCards.length >= 4) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">Turn</span><div class="showdown-cards-row">${state.communityCards.slice(3, 4).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    if (state.communityCards.length >= 5) {
      html += `<div class="showdown-board-group"><span class="showdown-board-label">River</span><div class="showdown-cards-row">${state.communityCards.slice(4, 5).map(c => createCardHTML(c, false, false)).join('')}</div></div>`;
    }
    html += `</div>`;
  }

  // Chaque joueur : sa main + ses hole cards avec ★ si utilisées
  html += activePlayers.map(p => {
    const allCards = [...p.holeCards, ...state.communityCards];
    const hand = p.bestHand || evaluateHand(allCards);
    const isWinner = results.some(r => r.winners && r.winners.some(w => w && w.id === p.id));
    const winnerClass = isWinner ? ' winner-highlight' : '';

    // Identifier quelles hole cards sont dans la meilleure combinaison
    const bestSet = new Set(hand.bestCards.map(c => `${c.rank}|${c.suit}`));

    const holeHTML = p.holeCards.map(c => {
      const isBest = bestSet.has(`${c.rank}|${c.suit}`);
      const wrapperClass = isBest ? 'card-wrapper' : 'card-wrapper wrapper-unused';
      return `<div class="${wrapperClass}">${createCardHTML(c, false, false)}<span class="card-marker ${isBest ? 'marker-best' : 'marker-unused'}">${isBest ? '★' : ''}</span></div>`;
    }).join('');

    return `
      <div class="showdown-player${winnerClass}">
        <div class="showdown-name" style="color:${p.color}">
          ${p.isNPC ? '🤖' : '👤'} ${p.name} ${isWinner ? '👑' : ''}
        </div>
        <div class="showdown-hand-name" style="font-size:15px;font-weight:700;margin-bottom:4px;color:#f0d060">${hand.desc}</div>
        <div class="showdown-cards-row">${holeHTML}</div>
      </div>
    `;
  }).join('');

  cardsDiv.innerHTML = html;

  // Montant gagné
  const totalWon = results.reduce((sum, r) => sum + r.pot, 0);
  amountP.textContent = `Pot total : ${totalWon} jetons`;

  // Bouton main suivante
  const nextBtn = document.getElementById('next-hand-btn');
  nextBtn.textContent = 'Main suivante ▶';
  state._gameOver = false;

  // Animation de célébration
  const winnerCard = overlay.querySelector('.winner-card');
  if (winnerCard) winnerCard.classList.add('winner-pulse');
  setTimeout(() => { if (winnerCard) winnerCard.classList.remove('winner-pulse'); }, 4500);

  overlay.classList.remove('hidden');
}

function endGame() {
  const playersWithChips = state.players.filter(p => p.chips > 0);
  const winner = playersWithChips[0];

  // Construire le résumé
  const handsPlayed = state.handNumber;
  const pots = logEntries.filter(e => e.msg.startsWith('Le ') || e.msg.includes('remporte')).map(e => {
    const m = e.msg.match(/(\d+) jetons/);
    return m ? parseInt(m[1]) : 0;
  });
  const biggestPot = pots.length > 0 ? Math.max(...pots) : 0;
  const totalPots = pots.reduce((a, b) => a + b, 0);

  // Joueurs classés par jetons
  const sorted = [...state.players].sort((a, b) => b.chips - a.chips);
  const ranking = sorted.map((p, i) => `${i+1}. ${p.isNPC ? '🤖' : '👤'} ${p.name} : ${p.chips} jetons`).join('<br>');

  const overlay = document.getElementById('winner-overlay');
  document.getElementById('winner-title').textContent = winner
    ? `🏆 ${winner.name} remporte la partie !`
    : 'Match nul !';

  // Préserver le showdown précédent s'il existe, sinon affichage simple
  const showdownHTML = state._lastShowdownHTML || '';
  state._lastShowdownHTML = '';
  document.getElementById('showdown-cards').innerHTML = `
    ${showdownHTML ? `<div class="previous-showdown">${showdownHTML}</div>` : ''}
    <div class="game-summary">
      <div class="summary-stats">
        <div>🃏 <b>${handsPlayed}</b> mains jouées</div>
        <div>💰 Plus gros pot : <b>${biggestPot}</b> jetons</div>
      </div>
      <div class="summary-ranking">
        <h4>Classement final</h4>
        <div class="ranking-list">${ranking}</div>
      </div>
      <div class="summary-buttons">
        <button id="save-summary-btn" class="btn btn-sm">📥 Sauvegarder le résumé</button>
        <button id="save-history-btn" class="btn btn-sm">📋 Sauvegarder l'historique</button>
      </div>
    </div>
  `;
  document.getElementById('winner-amount').textContent = '';
  document.getElementById('next-hand-btn').textContent = 'Nouvelle partie';
  state._gameOver = 'summary';
  overlay.classList.remove('hidden');

  document.getElementById('action-bar').classList.add('hidden');
  addLog(`🏆 Partie terminée ! ${winner ? winner.name + ' gagne !' : ''}`);

  // Listeners pour la sauvegarde
  setTimeout(() => {
    const saveSummary = document.getElementById('save-summary-btn');
    const saveHistory = document.getElementById('save-history-btn');
    if (saveSummary) saveSummary.addEventListener('click', () => {
      const limitLabel = state.limitMode === 'nolimit' ? 'No Limit' : state.limitMode === 'potlimit' ? 'Pot Limit' : 'Fixed Limit';
      const text = `Résumé de la partie Texas Hold'em ${limitLabel}\n` +
        `==========================================\n` +
        `Gagnant : ${winner ? winner.name : 'Match nul'}\n` +
        `Mains jouées : ${handsPlayed}\n` +
        `Plus gros pot : ${biggestPot} jetons\n\n` +
        `Classement final :\n${sorted.map((p, i) => `${i+1}. ${p.name} : ${p.chips} jetons`).join('\n')}\n`;
      downloadText(text, `resume_poker_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`);
    });
    if (saveHistory) saveHistory.addEventListener('click', exportLogs);
  }, 100);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function resetGame() {
  document.getElementById('winner-overlay').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
  state._gameOver = false;
  logEntries.length = 0;
  state.phase = 'setup';
  state.players = [];
  state.communityCards = [];
  state.deck = [];
  state.pot = 0;
  state.dealerIndex = 0;
  state.currentPlayerIndex = -1;
  state.currentBet = 0;
  state.awaitingAction = false;
  state.handNumber = 0;
  state.playersActed = new Set();
  nextPlayerId = 0;
  hideCardsOverlay();
  document.getElementById('player-name-input').value = '';
  document.getElementById('toggle-human').click();
  document.getElementById('toggle-nolimit').click();
  renderSetup();
}

// --- Event Handlers ---

function initEventListeners() {
  // Setup : mode Humain / PNJ
  let setupMode = 'human'; // 'human' | 'npc'
  let selectedNpcId = null;

  function buildNpcGrid() {
    const grid = document.getElementById('npc-cards');
    grid.innerHTML = NPC_TEMPLATES.map(npc => `
      <div class="npc-card ${selectedNpcId === npc.id ? 'selected' : ''}" data-npc-id="${npc.id}">
        <div class="npc-card-emoji">${npc.emoji}</div>
        <div class="npc-card-name">${npc.name}</div>
        <div class="npc-card-archetype">${npc.archetype}</div>
        ${anonymousMode ? '' : `<div class="npc-card-desc">${npc.description}</div>`}
        ${anonymousMode ? '' : `<div class="npc-card-backstory">${npc.backstory}</div>`}
        <div class="npc-card-traits">
          ${Object.entries(npc.traits).map(([k, v]) => `
            <span class="npc-trait"><span class="trait-label">${k}</span><span class="trait-bar"><span class="trait-fill" style="width:${v*100}%"></span></span></span>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Event listeners sur les cartes PNJ
    grid.querySelectorAll('.npc-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedNpcId = card.dataset.npcId;
        buildNpcGrid();
      });
    });
  }

  document.getElementById('toggle-human').addEventListener('click', () => {
    setupMode = 'human';
    document.getElementById('toggle-human').classList.add('active');
    document.getElementById('toggle-npc').classList.remove('active');
    document.getElementById('npc-grid').classList.add('hidden');
    document.getElementById('player-name-input').placeholder = 'Nom du joueur...';
    selectedNpcId = null;
  });

  document.getElementById('toggle-npc').addEventListener('click', () => {
    setupMode = 'npc';
    document.getElementById('toggle-npc').classList.add('active');
    document.getElementById('toggle-human').classList.remove('active');
    document.getElementById('npc-grid').classList.remove('hidden');
    document.getElementById('player-name-input').placeholder = 'Nom personnalisé (optionnel)...';
    buildNpcGrid();
  });

  // Setup : mode de limite
  document.getElementById('toggle-nolimit').addEventListener('click', () => {
    state.limitMode = 'nolimit';
    document.getElementById('toggle-nolimit').classList.add('active');
    document.getElementById('toggle-potlimit').classList.remove('active');
    document.getElementById('toggle-fixedlimit').classList.remove('active');
  });

  document.getElementById('toggle-potlimit').addEventListener('click', () => {
    state.limitMode = 'potlimit';
    document.getElementById('toggle-potlimit').classList.add('active');
    document.getElementById('toggle-nolimit').classList.remove('active');
    document.getElementById('toggle-fixedlimit').classList.remove('active');
  });

  document.getElementById('toggle-fixedlimit').addEventListener('click', () => {
    state.limitMode = 'fixedlimit';
    document.getElementById('toggle-fixedlimit').classList.add('active');
    document.getElementById('toggle-nolimit').classList.remove('active');
    document.getElementById('toggle-potlimit').classList.remove('active');
  });

  // Info mode de limite
  document.getElementById('toggle-limit-info').addEventListener('click', () => {
    const info = document.getElementById('limit-info');
    info.classList.toggle('hidden');
  });

  // Setup : ajouter joueur
  document.getElementById('add-player-btn').addEventListener('click', () => {
    if (setupMode === 'npc') {
      if (!selectedNpcId) {
        alert('Choisis un personnage PNJ dans la grille ci-dessous.');
        return;
      }
      const npcData = NPC_TEMPLATES.find(t => t.id === selectedNpcId);
      const input = document.getElementById('player-name-input');
      const customName = input.value.trim() || npcData.name;
      if (addPlayer(customName, true, npcData)) {
        input.value = '';
        // Garder la sélection pour permettre les doublons
        buildNpcGrid();
        renderSetup();
      }
    } else {
      const input = document.getElementById('player-name-input');
      const name = input.value.trim();
      if (addPlayer(name, false)) {
        input.value = '';
        input.focus();
        renderSetup();
      }
    }
  });

  document.getElementById('player-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-player-btn').click();
    }
  });

  // Setup : démarrer la partie
  // Remplissage aléatoire de PNJ
  document.getElementById('random-fill-btn').addEventListener('click', () => {
    // Ajouter d'abord le joueur humain s'il n'existe pas
    const hasHuman = state.players.some(p => !p.isNPC);
    if (!hasHuman && state.players.length === 0) {
      const humanName = document.getElementById('player-name-input').value.trim() || 'Moi';
      addPlayer(humanName, false);
    }
    // Ajouter 3 à 5 PNJ aléatoires
    const npcCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < npcCount && state.players.length < 7; i++) {
      const template = NPC_TEMPLATES[Math.floor(Math.random() * NPC_TEMPLATES.length)];
      addPlayer(template.name, true, template);
    }
    renderSetup();
    document.getElementById('start-game-btn').disabled = state.players.length < 2;
  });

  // Mode anonyme
  document.getElementById('anonymous-mode-checkbox').addEventListener('change', (e) => {
    anonymousMode = e.target.checked;
    buildNpcGrid(); // rafraîchir la grille pour masquer/afficher les descriptions
  });

  document.getElementById('start-game-btn').addEventListener('click', () => {
    state.startingChips = parseInt(document.getElementById('starting-chips').value) || 1000;
    state.smallBlind = parseInt(document.getElementById('small-blind').value) || 10;
    state.bigBlind = parseInt(document.getElementById('big-blind').value) || 20;
    state.minRaise = state.bigBlind;
    state.players.forEach(p => { p.chips = state.startingChips; });
    state.dealerIndex = Math.floor(Math.random() * state.players.length);

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('action-bar').classList.add('hidden');

    const limitLabel = state.limitMode === 'fixedlimit' ? 'Fixed Limit' : state.limitMode === 'potlimit' ? 'Pot Limit' : 'No Limit';
    addLog(`🃏 Nouvelle partie de Texas Hold'em (${limitLabel}) !`);
    startNewHand();
  });

  // Actions joueur
  document.getElementById('fold-btn').addEventListener('click', () => {
    if (!state.awaitingAction) return;
    playerFold();
    renderAll();
  });

  document.getElementById('check-call-btn').addEventListener('click', () => {
    if (!state.awaitingAction) return;
    playerCheckCall();
    renderAll();
  });

  document.getElementById('raise-btn').addEventListener('click', () => {
    if (!state.awaitingAction) return;
    const cp = state.players[state.currentPlayerIndex];
    const toCall = state.currentBet - cp.currentBet;

    // Fixed Limit : relance directe (pas de slider)
    if (state.limitMode === 'fixedlimit') {
      const fixedBet = getFixedLimitBet();
      const raiseBy = fixedBet;
      const totalNeeded = toCall + raiseBy;
      if (totalNeeded > cp.chips) return;
      playerRaise(raiseBy);
      renderAll();
      return;
    }

    const minTotal = state.currentBet + state.minRaise;
    const potSize = computePotSize();
    const potLimitMax = cp.currentBet + potSize + 2 * toCall;
    const absoluteMax = cp.chips + cp.currentBet;
    const maxTotal = state.limitMode === 'potlimit' ? Math.min(potLimitMax, absoluteMax) : absoluteMax;

    // All-in en dessous du minRaise : quand le joueur n'a pas assez pour une relance complète
    const isAllInBelowMin = maxTotal < minTotal;

    // Afficher les contrôles de relance
    const raiseControls = document.getElementById('raise-controls');
    const slider = document.getElementById('raise-slider');
    const amountSpan = document.getElementById('raise-amount');

    if (isAllInBelowMin) {
      // All-in forcé : une seule valeur possible
      slider.min = maxTotal;
      slider.max = maxTotal;
      slider.value = maxTotal;
      slider.step = 1;
    } else {
      slider.min = minTotal;
      slider.max = maxTotal;
      slider.value = Math.max(minTotal, Math.min(maxTotal, minTotal + state.minRaise));
      // Step = 1 quand le stack est petit, pour permettre la précision
      slider.step = (maxTotal - minTotal) < 50 ? 1 : Math.max(1, Math.floor(state.minRaise / 2));
    }
    amountSpan.textContent = slider.value;

    raiseControls.classList.remove('hidden');
    document.getElementById('raise-btn').classList.add('hidden');
    document.getElementById('fold-btn').classList.add('hidden');
    document.getElementById('check-call-btn').classList.add('hidden');
    document.getElementById('allin-btn').classList.add('hidden');

    slider.oninput = () => {
      amountSpan.textContent = parseInt(slider.value);
    };
  });

  document.getElementById('confirm-raise-btn').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('raise-slider').value);
    const cp = state.players[state.currentPlayerIndex];
    const toCall = state.currentBet - cp.currentBet;
    const raiseBy = amount - state.currentBet;

    document.getElementById('raise-controls').classList.add('hidden');
    document.getElementById('raise-btn').classList.remove('hidden');
    document.getElementById('fold-btn').classList.remove('hidden');
    document.getElementById('check-call-btn').classList.remove('hidden');
    document.getElementById('allin-btn').classList.remove('hidden');

    playerRaise(raiseBy);
    renderAll();
  });

  document.getElementById('cancel-raise-btn').addEventListener('click', () => {
    document.getElementById('raise-controls').classList.add('hidden');
    document.getElementById('raise-btn').classList.remove('hidden');
    document.getElementById('fold-btn').classList.remove('hidden');
    document.getElementById('check-call-btn').classList.remove('hidden');
    document.getElementById('allin-btn').classList.remove('hidden');
  });

  // Bouton all-in
  document.getElementById('allin-btn').addEventListener('click', () => {
    const cp = state.players[state.currentPlayerIndex];
    if (!cp || cp.chips === 0 || cp.isAllIn) return;

    const toCall = state.currentBet - cp.currentBet;
    const allInTotal = cp.chips + cp.currentBet;

    // Sécurité Pot Limit : vérifier que le tapis ne dépasse pas la mise max
    if (state.limitMode === 'potlimit') {
      const potSize = computePotSize();
      const potLimitMax = cp.currentBet + potSize + 2 * toCall;
      if (allInTotal > potLimitMax) {
        alert('En Pot Limit, vous ne pouvez pas miser plus que le pot. Utilisez le slider "Relancer" pour ajuster votre mise.');
        return;
      }
    }

    if (!confirm(`⚠️ Tout miser — ${cp.chips} jetons (all-in) ?`)) return;

    // Cacher les contrôles de relance si visibles
    document.getElementById('raise-controls').classList.add('hidden');

    if (toCall >= cp.chips) {
      // Déjà couvert par le call (l'all-in est juste un call complet)
      playerCheckCall();
    } else {
      // Relancer all-in : le montant = tout le stack en plus du call
      const raiseBy = cp.chips - toCall;
      playerRaise(raiseBy);
    }
    renderAll();
  });

  // Overlay cartes
  document.getElementById('hide-cards-btn').addEventListener('click', hideCardsOverlay);

  // Nouvelle main
  document.getElementById('new-hand-btn').addEventListener('click', () => {
    document.getElementById('winner-overlay').classList.add('hidden');
    document.getElementById('action-bar').classList.remove('hidden');
    hideCardsOverlay();
    startNewHand();
  });

  // Main suivante / Nouvelle partie — handler unifié
  document.getElementById('next-hand-btn').addEventListener('click', () => {
    if (state._gameOver === 'summary') {
      // Écran de fin de partie déjà affiché → retour au setup
      resetGame();
    } else if (state._gameOver === 'lastHand') {
      // Dernière main jouée → afficher l'écran de fin de partie
      endGame();
    } else {
      // Partie en cours → main suivante
      nextHandFromOverlay();
    }
  });

  // Fin de partie
  document.getElementById('end-game-btn').addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment quitter la partie ?')) {
      resetGame();
    }
  });

  // Panneau de log (ferme les conseils)
  document.getElementById('show-log-btn').addEventListener('click', () => {
    document.getElementById('advice-panel').classList.add('hidden');
    document.getElementById('log-panel').classList.remove('hidden');
  });

  document.getElementById('close-log-btn').addEventListener('click', () => {
    document.getElementById('log-panel').classList.add('hidden');
  });

  // Panneau de conseils (ferme le log)
  document.getElementById('toggle-advice-btn').addEventListener('click', toggleAdvice);
  document.getElementById('close-advice-btn').addEventListener('click', () => {
    document.getElementById('advice-panel').classList.add('hidden');
  });

  document.getElementById('export-log-btn').addEventListener('click', exportLogs);

  // Raccourcis clavier
  document.addEventListener('keydown', (e) => {
    if (state.phase === 'setup') return;

    // Échap pour cacher les cartes
    if (e.key === 'Escape') {
      hideCardsOverlay();
      if (!document.getElementById('winner-overlay').classList.contains('hidden')) {
        document.getElementById('winner-overlay').classList.add('hidden');
      }
    }

    if (!state.awaitingAction) return;

    // Raccourcis : F=Fold, C=Check/Call, R=Raise
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      document.getElementById('fold-btn').click();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      document.getElementById('check-call-btn').click();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const raiseControls = document.getElementById('raise-controls');
      if (raiseControls.classList.contains('hidden')) {
        document.getElementById('raise-btn').click();
      }
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      const allinBtn = document.getElementById('allin-btn');
      if (allinBtn && !allinBtn.classList.contains('hidden')) {
        allinBtn.click();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const raiseControls = document.getElementById('raise-controls');
      if (!raiseControls.classList.contains('hidden')) {
        document.getElementById('confirm-raise-btn').click();
      }
    }
  });
}

// --- Animation de jetons ---
function animateChipFly(fromEl, toEl, count = 5) {
  if (!fromEl || !toEl) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const colors = ['#f0d060','#e67e22','#e74c3c','#3498db','#2ecc71','#9b59b6'];

  for (let i = 0; i < count; i++) {
    const chip = document.createElement('div');
    chip.className = 'chip-particle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    chip.style.background = `radial-gradient(circle at 30% 30%, ${color}, #333)`;
    const startX = fromRect.left + fromRect.width/2 + (Math.random()-0.5)*30;
    const startY = fromRect.top + fromRect.height/2 + (Math.random()-0.5)*15;
    chip.style.left = `${startX}px`;
    chip.style.top = `${startY}px`;
    const dx = toRect.left + toRect.width/2 - startX;
    const dy = toRect.top + toRect.height/2 - startY;
    chip.style.setProperty('--fly-x', `${dx * 0.4}px`);
    chip.style.setProperty('--fly-y', `${dy * 0.4 - 40}px`);
    chip.style.setProperty('--fly-x-end', `${dx}px`);
    chip.style.setProperty('--fly-y-end', `${dy}px`);
    chip.style.animationDelay = `${i * 0.07}s`;
    document.body.appendChild(chip);
    setTimeout(() => chip.remove(), 750 + i * 70);
  }
}

// --- Conseils stratégiques en cours de partie ---
function generateAdvice() {
  const human = state.players.find(p => !p.isNPC);
  if (!human || human.folded || human.chips <= 0) return '';

  const toCall = state.currentBet - human.currentBet;
  const potSize = computePotSize();
  const isPreflop = state.phase === 'preflop';
  const limitLabel = state.limitMode === 'fixedlimit' ? 'Fixed Limit' : state.limitMode === 'potlimit' ? 'Pot Limit' : 'No Limit';
  const positionLabel = getPositionLabel(human);
  const npcInfo = state.players.filter(p => p.isNPC).map(p => `${p.npcEmoji} ${p.name} (${p.npcName})`).join(', ');

  let handEval = '';
  if (human.holeCards.length === 2) {
    const hc = human.holeCards;
    handEval = `🂠 ${hc[0].rank}${suitSymbol(hc[0].suit)} ${hc[1].rank}${suitSymbol(hc[1].suit)}`;
    if (!isPreflop) {
      const allCards = [...hc, ...state.communityCards];
      const best = evaluateHand(allCards);
      if (best) handEval += ` → <b>${best.desc}</b>`;
    }
  }

  const potOdds = toCall > 0 ? Math.round(toCall / (potSize + toCall) * 100) : 0;

  let tips = '';
  if (state.limitMode === 'fixedlimit') {
    tips = '🔒 En Fixed Limit, le coût est fixe → tu peux te permettre de jouer plus de mains.';
  } else if (state.limitMode === 'potlimit') {
    tips = '📏 En Pot Limit, la relance max est la taille du pot. Pense à protéger ta main avec des mises au pot.';
  } else {
    tips = '💰 En No Limit, attention aux sur-relances. Gère la taille du pot.';
  }

  if (isPreflop) {
    tips += ' Préflop : sélectionne tes mains de départ selon ta position. Plus tu es proche du bouton, plus tu peux jouer large.';
  } else if (state.phase === 'flop') {
    tips += ' Au flop : as-tu touché le board ? Une paire, un tirage ? Évalue ta force avant de t\'engager.';
  } else if (state.phase === 'turn') {
    tips += ' Au turn : les mises doublent en Fixed Limit. Si tu n\'as rien, c\'est le moment de folder.';
  } else if (state.phase === 'river') {
    tips += ' À la river : plus de cartes à venir. Value bet si tu as la meilleure main, sinon bluff ou abandonne.';
  }

  return `
    <div class="advice-section"><b>🎯 Ta main</b> : ${handEval || 'Pas encore distribuée'}</div>
    <div class="advice-section"><b>📍 Position</b> : ${positionLabel}</div>
    <div class="advice-section"><b>📐 Mode</b> : ${limitLabel}</div>
    <div class="advice-section"><b>🥣 Pot</b> : ${potSize} jetons${toCall > 0 ? ` | Pour suivre : ${toCall} (cote : ${potOdds}%)` : ''}</div>
    <div class="advice-section"><b>🤖 PNJ présents</b> : ${npcInfo}</div>
    <div class="advice-section advice-tips">${tips}</div>
  `;
}

function getPositionLabel(player) {
  const activePlayers = state.players.filter(p => p.chips > 0);
  const totalActive = activePlayers.length;

  // 2 joueurs = heads-up spécial
  if (totalActive === 2) {
    const idx = state.players.indexOf(player);
    if (idx === state.dealerIndex) return 'Dealer / SB';
    return 'Big Blind';
  }

  // Calculer la position parmi les joueurs actifs
  let posIdx = 0;
  const n = state.players.length;
  const playerIdx = state.players.indexOf(player);
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerIndex + i) % n;
    if (idx === playerIdx) break;
    if (state.players[idx].chips > 0) posIdx++;
  }

  // posIdx: 0=SB, 1=BB, 2=UTG, totalActive-2=CO, totalActive-1=BTN (dealer)
  if (posIdx === 0) return 'Small Blind (1er à parler postflop)';
  if (posIdx === 1) return 'Big Blind (dernier à parler préflop)';
  if (posIdx === totalActive - 1) return 'Dealer / Bouton (meilleure position)';
  if (totalActive >= 5 && posIdx === totalActive - 2) return 'Cutoff (avant-dernier)';
  if (posIdx === 2) return 'UTG (1er à parler préflop)';
  return `Milieu (${posIdx}e après le dealer)`;
}

function toggleAdvice() {
  const panel = document.getElementById('advice-panel');
  if (panel.classList.contains('hidden')) {
    document.getElementById('log-panel').classList.add('hidden');
    document.getElementById('advice-content').innerHTML = generateAdvice();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

// --- Initialisation ---
function init() {
  initEventListeners();
  renderSetup();

  // Ajouter des joueurs par défaut pour la démo
  addPlayer('Moi', false);
  addPlayer('Le Requin', true, NPC_TEMPLATES.find(t => t.id === 'le_requin'));
  addPlayer('Le Gambler', true, NPC_TEMPLATES.find(t => t.id === 'le_gambler'));
  addPlayer('Le Poisson', true, NPC_TEMPLATES.find(t => t.id === 'le_poisson'));
  renderSetup();
}

// Démarrer quand le DOM est prêt
document.addEventListener('DOMContentLoaded', init);
