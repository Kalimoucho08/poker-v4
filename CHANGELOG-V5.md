# Poker V5 — Résumé des évolutions (mai 2026)

## Pipeline stratégique dynamique (V5)

Architecture en **strategy pipe** : chaque module stratégique est un filtre qui module les seuils de décision des PNJ sans remplacer leur personnalité de base.

```
handStrength → [position] → [stack depth] → [board texture] → [multiway] → [phase] → [opponent model] → [GTO] → [personnalité finale] → décision
```

### Modules stratégiques (`strategies/`)
| Module | Rôle |
|---|---|
| `position.js` | Ranges préflop par position (SB, BB, UTG, MP, CO, BTN), gap concept |
| `stack-depth.js` | Zones (red/orange/yellow/green/deep), SPR, M-ratio, push/fold |
| `board-texture.js` | Classification dry/wet/paired, ajustements c-bet/bluff |
| `multiway.js` | Ajustements heads-up vs full ring |
| `phase.js` | Ajustements par street (c-bet flop, sizing turn, value river) |
| `opponent-model.js` | Tracking VPIP/PFR, classification TAG/LAG/Station/Rock/Maniac |
| `gto.js` | Fréquences de bluff optimales (Sklansky), MDF |

### Traits enfin utilisés
- **adaptability** : blend entre force brute et force ajustée (Le Roc 0.20 ignore le contexte, L'Artiste 0.90 le suit)
- **tiltResist** : résistance au tilt après bad beat (perte avec flush+ → tilt++, gagner → tilt--)

## Bugs corrigés

| Bug | Cause | Fix |
|---|---|---|
| Retour setup après chaque main | `endGame()` laissait `onclick=resetGame` survivant aux parties suivantes | Handler unifié avec flag `state._gameOver` |
| All-in impossible (stack < minRaise) | `canRaise` exigeait d'atteindre le minRaise | All-in toujours autorisé, slider adaptatif (step=1) |
| Exports vides (0 octet) | `<a>` non attaché au DOM avant `click()` | `appendChild` + `setTimeout` avant `removeChild` |
| Écran fin de partie invisible | `resetGame()` et `nextHandFromOverlay()` s'exécutaient simultanément | Handler unifié, _gameOver = 'lastHand' → 'summary' |
| Dernière main sans résultat | `endGame()` appelé directement sans afficher le résultat de la main | showWinByFoldOverlay/showWinnerOverlay d'abord, _gameOver='lastHand' |
| Ordre parole short-handed | `findFirstToAct()` utilisait n=total joueurs au lieu d'actifs | Utilise `activeCount` (chips > 0) |
| Positions incorrectes short-handed | `getPositionLabel()` basé sur total joueurs | Recalcul basé sur joueurs actifs |
| Donneur sur joueurs éliminés | Rotation dealer = `(idx+1) % n` sans skip | `findNextPlayerWithChips()` |
| Blinds HU incorrectes | `postBlinds()` vérifiait `n===2` sur total joueurs | Vérifie `activeCount === 2` |

## Fonctionnalités ajoutées

- **Bouton "Tapis !"** : rouge avec animation glow, confirmation, raccourci `A`
- **Badges SB/BB** : visuels sur les sièges pendant le jeu
- **Piles de mises** : jetons affichés devant chaque joueur
- **Animation jetons** : blinds et mises volent vers le pot
- **🎲 Remplissage aléatoire** : bouton setup, 3-5 PNJ aléatoires
- **🕶️ Mode anonyme** : noms génériques (Joueur A, B...), archétypes et catchphrases masqués

## Architecture

```
poker-v5/
├── index.html, style.css
├── game.js          — moteur de jeu (+ V5: handHistory, _gameOver, animations)
├── npcs.js          — 6 PNJ + évaluation mains
├── decide.js        — npcDecide() enrichi (pipeline stratégique)
├── simulate.js      — simulation headless
├── strategies/
│   ├── loader.js           — createContext, runStrategyPipe, applyPersonalityFinal
│   ├── position.js, stack-depth.js, board-texture.js
│   ├── multiway.js, phase.js, opponent-model.js, gto.js
```

## Session du 15 mai 2026

12 commits — de la copie V4 initiale à la version stable avec :
- Pipeline stratégique 7 modules
- 9 bugs corrigés
- 4 features UI/UX (all-in button, blinds visuels, animations, mode anonyme)
