# CHANGELOG V6 — UI/UX & Corrections

## Table & Layout
- **Chevauchement pot/cartes résolu** : `.pot-area` top 38→26%, `.community-area` top 50→56%
- **min-height: 420px** sur `.poker-table` pour éviter l'écrasement vertical
- **Breakpoint 1024px** : table 85vw×50vh, action-bar adaptée

## Panneaux
- **Log et Conseils mutuellement exclusifs** : ouvrir l'un ferme automatiquement l'autre

## CSS
- Accolade orpheline supprimée (ligne 276)
- 4 sélecteurs dupliqués fusionnés (`.pot-display`, `.winner-card`, `.player-info`, `.showdown-hand-name`)

## Pot Limit
- Bouton "Tapis" grisé si le stack dépasse la mise max autorisée (`absoluteMax > potLimitMax`)
- Formule NPC corrigée : `maxRaiseAmount = potSize + toCall` (était juste `potSize`)
- Double bouton tapis corrigé : le bouton dédié se masque quand le bouton Relancer affiche déjà "Tapis"

## Logs
- Type de partie affiché : `Nouvelle partie de Texas Hold'em (Pot Limit) !`
- Chaque main logge le mode : `--- Main #3 (Pot Limit) ---`
- Cartes communes loggées au showdown : `🃏 Cartes communes : [As Roi Dame...]`

## Showdown
- Showdown de la dernière main préservé dans l'écran de fin de partie (`.previous-showdown` au-dessus du résumé)
