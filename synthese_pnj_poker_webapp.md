# Synthèse — IA de PNJ de poker pour une webapp JavaScript

Cette synthèse regroupe les options réalistes pour construire des PNJ de poker robustes dans une webapp JavaScript, avec ou sans serveur. Elle couvre les algorithmes, leur compatibilité avec les variantes de poker, les contraintes techniques du navigateur et des recommandations directement exploitables par une IA de coding [cite:3][cite:16][cite:31].

## Objectif produit

Pour une webapp, le vrai enjeu n'est pas seulement de “faire jouer un bot”, mais de produire un comportement crédible, réglable, performant et maintenable. En pratique, le meilleur choix dépend de quatre variables : la variante de poker, la structure de mise, le niveau de force recherché pour le PNJ, et l'architecture de l'application — full client-side ou avec backend [cite:16][cite:21][cite:31].

Deux réalités structurent presque toutes les décisions techniques : d'une part, le poker est un jeu à information incomplète, ce qui rend les arbres de décision beaucoup plus complexes que dans les échecs ou le go ; d'autre part, le navigateur impose des contraintes de mémoire, de temps CPU et de fluidité de l'interface, surtout si tout doit tourner côté client [cite:3][cite:12][cite:31].

## Familles d'algorithmes

### Heuristiques et règles expertes

Les bots heuristiques utilisent des règles explicites : force de la main, texture du board, position, taille du pot, profil adverse, fréquence de bluff, et parfois quelques tableaux préflop. Cette approche est simple à coder, facile à régler et particulièrement adaptée à un jeu web où l'on veut plusieurs niveaux de difficulté lisibles et stables [cite:16][cite:31][cite:40].

Elle convient très bien à des PNJ “débutant”, “serré”, “agressif”, “calling station” ou “trickster”, car la personnalité du bot peut être contrôlée directement par des paramètres. En revanche, une approche purement heuristique devient fragile si l'objectif est de produire un adversaire très fort ou difficile à exploiter sur le long terme [cite:16][cite:22].

### Monte Carlo

Les approches Monte Carlo simulent de très nombreuses distributions de cartes possibles pour estimer l'équité d'une main et guider la décision. C'est l'une des meilleures options pour une webapp, car la logique est compréhensible, les résultats sont crédibles et l'implémentation existe déjà dans l'écosystème JavaScript [cite:17][cite:33][cite:36].

En pratique, Monte Carlo est particulièrement fort pour les évaluations postflop, pour le calcul de win rate et pour des PNJ de niveau intermédiaire à fort. Le principal point d'attention n'est pas la qualité stratégique pure, mais le coût CPU, qui impose souvent d'exécuter les simulations dans un Web Worker pour ne pas bloquer l'interface [cite:33][cite:36][cite:42].

### MCTS et variantes pour information incomplète

Le Monte Carlo Tree Search adapté aux jeux à information incomplète peut être utilisé pour construire des décisions plus riches que le simple calcul d'équité. Il suit une logique de sélection, expansion, simulation et rétropropagation, et peut intégrer des hypothèses sur les cartes adverses [cite:18][cite:21].

Cependant, pour une webapp de poker, MCTS reste généralement plus complexe à stabiliser qu'un moteur heuristique ou qu'un Monte Carlo bien conçu. Surtout, cette famille ne donne pas naturellement les garanties d'équilibre stratégique associées à CFR, ce qui la rend moins attractive pour un bot “expert” censé être très robuste [cite:21][cite:27].

### CFR, MCCFR et CFR+

Counterfactual Regret Minimization est la grande famille de référence pour le poker compétitif. Les travaux fondateurs montrent que la stratégie moyenne produite par CFR converge vers un équilibre de Nash dans les jeux à information incomplète, ce qui en fait une base solide pour des bots très difficiles à exploiter [cite:3][cite:12].

Dans la pratique, les variantes Monte Carlo CFR et CFR+ sont plus utiles que le CFR de base, car elles réduisent le coût computationnel et rendent l'entraînement plus viable. C'est le socle conceptuel des grandes IA de poker modernes, notamment celles qui ont battu des joueurs professionnels humains [cite:6][cite:9][cite:10].

Pour une webapp, la conséquence est importante : il est réaliste d'utiliser du CFR en JavaScript pour de petits jeux abstraits ou pédagogiques, mais pas raisonnable d'entraîner un vrai solveur complet de No-Limit Hold'em directement dans le navigateur. La voie réaliste consiste à entraîner hors ligne, puis à embarquer une stratégie simplifiée, compressée ou abstraite côté client [cite:32][cite:35][cite:43].

### Deep CFR et RL

Les approches de type Deep CFR ou reinforcement learning s'appuient sur des réseaux de neurones et du self-play pour généraliser sur de très grands espaces d'états. Elles peuvent produire des bots extrêmement forts, mais leur coût de conception, d'entraînement, de validation et de déploiement dépasse largement ce qui est raisonnable pour une webapp standard sans infrastructure dédiée [cite:8][cite:28][cite:38].

Pour un produit web, ces approches deviennent pertinentes surtout si le navigateur ne sert que d'interface et qu'un backend fait tourner le modèle, ou bien si l'on charge un modèle déjà entraîné et fortement simplifié. Elles sont donc possibles, mais rarement le meilleur premier choix pour un projet JavaScript pragmatique [cite:28][cite:38].

## Compatibilité avec les variantes de poker

### Texas Hold'em

Le Texas Hold'em est de loin la variante la mieux documentée et la plus compatible avec tout l'éventail des algorithmes. C'est sur cette variante que la littérature, les implémentations open source et les grands succès de l'IA de poker sont les plus nombreux [cite:1][cite:3][cite:10].

Pour du Hold'em en webapp, les heuristiques sont simples à mettre en place, Monte Carlo fonctionne très bien, et CFR/MCCFR devient pertinent si l'on veut un bot d'élite ou un système d'aide stratégique embarqué. C'est clairement la meilleure cible pour une première version robuste [cite:17][cite:23][cite:33].

### Omaha

L'Omaha augmente fortement la complexité combinatoire, notamment parce qu'il faut composer exactement deux cartes privées parmi quatre avec trois cartes du board. Cette explosion du nombre de combinaisons rend le raisonnement plus coûteux et rend les abstractions CFR plus difficiles à industrialiser que pour le Hold'em [cite:17][cite:21].

Dans ce contexte, Monte Carlo devient souvent l'option la plus pragmatique. Les heuristiques restent possibles, mais elles sont plus délicates à calibrer, et les approches de type CFR sont beaucoup moins fréquentes dans les implémentations accessibles et documentées [cite:21][cite:33].

### Draw, Stud, Hi-Lo et formats atypiques

Les variantes comme 5-Card Draw ou les mini-jeux pédagogiques type Kuhn ou Leduc sont très compatibles avec CFR et parfaites pour l'apprentissage ou les prototypes. À l'inverse, Stud ou Omaha Hi-Lo exigent des évaluateurs plus spécifiques, ce qui favorise souvent Monte Carlo ou des heuristiques spécialisées plutôt qu'un solveur ambitieux côté client [cite:12][cite:15][cite:21].

## Impact des structures de mise

### Fixed-Limit

Le Fixed-Limit est la structure la plus simple pour les algorithmes avancés, car l'espace d'actions est fortement discrétisé. Cela réduit l'arbre de décision et facilite énormément l'utilisation de CFR, tout en rendant les heuristiques et Monte Carlo plus simples à calibrer [cite:6][cite:12].

Pour une IA de coding, c'est un excellent point de départ si le but est de produire rapidement un bot solide, explicable et peu coûteux à exécuter. C'est aussi la meilleure structure si l'on veut une version client-side très légère [cite:6][cite:31].

### Pot-Limit

Le Pot-Limit occupe une position intermédiaire : la taille des mises varie, mais reste bornée par le pot. Cela donne plus de richesse stratégique que le Fixed-Limit, tout en restant plus contrôlable que le No-Limit [cite:21][cite:31].

En pratique, Monte Carlo y fonctionne très bien, surtout en Omaha Pot-Limit, et les heuristiques peuvent rester crédibles si l'on encode correctement les tailles de mise préférées. Pour une webapp, c'est une structure très faisable, à condition de bien normaliser les sizings [cite:21][cite:33].

### No-Limit

Le No-Limit est la structure la plus difficile, car le nombre de mises possibles est immense. Pour CFR, cela impose des abstractions d'action ; pour les heuristiques, cela exige une vraie politique de sizing ; et pour Monte Carlo, cela ne résout pas à lui seul la qualité stratégique de la décision de mise [cite:3][cite:9][cite:12].

C'est pourtant la structure la plus intéressante si l'objectif est de produire un adversaire moderne et crédible en Texas Hold'em. Dans une webapp, elle est faisable, mais seulement si l'on simplifie fortement le problème : sizings discrets, profils de bots, règles explicites et, pour les bots experts, stratégies pré-entraînées [cite:23][cite:31][cite:32].

## Faisabilité en JavaScript

## Sans serveur

Une webapp 100 % client-side en JavaScript est réaliste pour trois catégories de solutions : heuristiques pures, heuristiques plus Monte Carlo, et lecture d'une stratégie pré-calculée simplifiée. Ces trois approches couvrent déjà un spectre très large de qualité de jeu et de difficulté perçue [cite:31][cite:33][cite:36].

Le navigateur est bien adapté à la gestion de règles, à l'évaluation de mains, à la simulation Monte Carlo et à l'utilisation de Web Workers. En revanche, il devient vite contraint pour l'entraînement massif, les tables de stratégie volumineuses, les réseaux de neurones lourds et les solveurs ambitieux [cite:31][cite:36][cite:42].

### Avec serveur

Une architecture avec serveur devient pertinente dès que le projet vise l'un des objectifs suivants : bots très forts de type CFR/Deep CFR, adaptation en ligne au profil du joueur, calculs longs, analytics, anti-triche, ou orchestration multijoueur sérieuse. Dans ce cas, le navigateur ne porte plus l'intelligence principale ; il orchestre l'interface et interroge une API [cite:28][cite:31][cite:38].

Le backend peut être en Node.js si l'on veut garder un stack homogène JavaScript, ou en Python si l'on veut réutiliser plus facilement des outils académiques et des bibliothèques de calcul existantes. Le choix dépend surtout de l'écosystème de solveur et du niveau d'ambition algorithmique [cite:23][cite:28][cite:32].

## Recommandations d'architecture pour une IA de coding

### Option A — Webapp sans serveur

Cette option est la plus pragmatique pour un premier produit jouable. L'IA de coding doit être orientée vers une architecture modulaire en JavaScript avec les composants suivants : moteur de règles, évaluateur de mains, bot heuristique, module Monte Carlo, gestionnaire de profils de PNJ, Web Worker de calcul, et couche UI séparée [cite:33][cite:34][cite:36].

La stratégie recommandée est la suivante :

- Utiliser des tableaux préflop simplifiés pour le Texas Hold'em.
- Calculer l'équité postflop par simulation Monte Carlo.
- Définir des tailles de mise discrètes, par exemple check, 33 %, 66 %, pot, all-in.
- Donner à chaque PNJ un profil de style et des seuils différents.
- Déporter tout calcul Monte Carlo un peu lourd dans un Web Worker.
- Prévoir un niveau “expert” fondé sur une table JSON de stratégie pré-calculée pour certains spots fréquents [cite:31][cite:33][cite:36].

Cette architecture convient très bien à un jeu éducatif, à une démonstration, à un poker casual ou à un prototype avancé. Elle est aussi la plus facile à faire générer par une IA de coding, car chaque module a des responsabilités claires et testables [cite:34][cite:40].

### Option B — Webapp avec serveur léger

Cette option est adaptée si l'on veut un PNJ plus fort et plus évolutif sans plonger immédiatement dans le deep learning. L'IA de coding doit alors séparer le front web, un backend d'API, et un module de décision serveur capable d'utiliser des tables de stratégie, des abstractions de ranges et éventuellement un moteur CFR pré-entraîné [cite:23][cite:31][cite:32].

Le navigateur envoie un état de jeu compact, le serveur renvoie une distribution d'actions et éventuellement un niveau d'explication. Cela permet d'avoir des bots plus puissants tout en gardant un front très fluide, y compris sur des machines modestes [cite:23][cite:31].

### Option C — Webapp avec serveur fort ou moteur hybride

Cette option vise un niveau plus ambitieux : bots d'élite, adaptation fine au joueur, analytics, logs de coups, entraînement offline, et éventuellement A/B testing stratégique. Dans ce cas, l'IA de coding doit penser en termes de pipeline : simulation, entraînement, export de stratégies, service d'inférence, télémétrie, et interface d'administration [cite:28][cite:38][cite:43].

Ce type d'architecture est crédible pour un produit sérieux ou un laboratoire personnel de poker IA, mais il est probablement disproportionné pour une première webapp jouable. Il faut le réserver aux cas où la valeur du projet dépend vraiment de la force de l'IA plus que de l'expérience utilisateur [cite:28][cite:38].

## Conseils concrets à donner à une IA de coding

Pour obtenir de bons résultats, il faut guider l'IA de coding avec une cible de produit claire. Le brief le plus efficace est généralement de demander une architecture en couches, avec des interfaces bien définies plutôt qu'un “bot magique” monolithique [cite:31][cite:34].

Le cahier des charges conseillé est le suivant :

- Variante cible : Texas Hold'em d'abord, Omaha ensuite.
- Structure de mise : commencer par Fixed-Limit ou Pot-Limit, puis passer au No-Limit avec sizings discrets.
- Niveau 1 : bot heuristique lisible.
- Niveau 2 : bot heuristique + Monte Carlo.
- Niveau 3 : bot expert à base de stratégie pré-entraînée.
- Interface : calcul asynchrone, animation non bloquante, état de table sérialisable.
- Tests : tests unitaires sur règles, évaluation de mains, équité, cohérence des actions et stabilité des sizings [cite:3][cite:31][cite:33].

Il est également utile d'imposer à l'IA de coding certaines contraintes de design logiciel :

- Une classe ou un module `GameState` purement déterministe.
- Un module `HandEvaluator` séparé du moteur de décision.
- Une interface `BotStrategy.decide(gameState, playerModel)`.
- Un `Worker` dédié pour les calculs Monte Carlo.
- Un format JSON ou binaire compact pour les stratégies pré-entraînées.
- Un système de “personnalité” de PNJ indépendant du moteur mathématique [cite:31][cite:33][cite:36].

## Recommandation finale

Pour un projet de webapp réaliste, le meilleur chemin est presque toujours le suivant : commencer par **Texas Hold'em**, utiliser **heuristiques + Monte Carlo** côté client, discrétiser les sizings, puis décider ensuite si un backend est nécessaire. Cette base permet d'obtenir vite un produit jouable, crédible et extensible, sans se piéger trop tôt dans la complexité des solveurs avancés [cite:17][cite:31][cite:33].

Si l'objectif est un bot “fort mais faisable”, une webapp sans serveur suffit largement. Si l'objectif est un bot “très fort, adaptatif, quasi inexploitable”, il faut basculer vers une architecture hybride avec entraînement hors ligne et service de décision côté serveur [cite:3][cite:23][cite:28].
