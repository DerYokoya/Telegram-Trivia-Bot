**Français** | [English](./README.md)

# Bot Telegram de Quiz

Un bot Telegram qui génère des questions de quiz sur n’importe quel sujet grâce à un LLM, avec modes solo et groupe, système de score, achievements et classements. Construit avec TypeScript, Telegraf et Groq.

## Démo vidéo

https://github.com/user-attachments/assets/e5f86bf1-aa36-40b8-bb08-26849f96e006

### Test

https://github.com/user-attachments/assets/138c8353-daff-4261-98e0-4ceb87942f23

## Captures d’écran

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img width="250" alt="Tele-Bot-1" src="https://github.com/user-attachments/assets/7d8f43fc-5c17-448d-8acb-d28b82135b4d" /><br />
        <sub><b>Aperçu de l’interface (Démarrage)</b></sub>
      </td>
      <td align="center">
        <img width="250" alt="Tele-Bot-2" src="https://github.com/user-attachments/assets/2ecf3a83-f619-4d10-8e82-922c7f5db2e5" /><br />
        <sub><b>Questions</b></sub>
      </td>
      <td align="center">
        <img width="250" alt="Tele-Bot-3" src="https://github.com/user-attachments/assets/8bed2dd0-743a-4f56-acdb-3d09f701f7f2" /><br />
        <sub><b>Achievements</b></sub>
      </td>
    </tr>
  </table>
</div>

## Comment ça fonctionne

Tu choisis un sujet, un nombre de questions et un niveau de difficulté. Le bot essaie d’abord de trouver le sujet dans [OpenTDB](https://opentdb.com). S’il ne trouve rien, il utilise [Groq](https://groq.com) pour générer des questions à la volée. Le score prend en compte la précision, la difficulté et la vitesse de réponse, puis peut être enregistré dans un classement global et par catégorie si l’utilisateur l’autorise.

## Choix de design

### Pourquoi TypeScript ?

TypeScript a été choisi pour plusieurs raisons importantes :

1. **Sécurité des types pour les machines à états complexes** — Les quiz solo et groupe gèrent des états complexes (question actuelle, résultats, timers, cooldowns). TypeScript garantit que les transitions sont valides et évite les erreurs runtime comme `null` ou `undefined`.

2. **Contrats d’API stricts** — Le bot interagit avec Groq, OpenTDB et PostgreSQL. Les interfaces TypeScript définissent les formes exactes des réponses.

3. **Meilleure expérience développeur** — Autocomplétion, documentation inline et lisibilité améliorent la maintenabilité.

4. **Refactorisation plus sûre** — Les changements de structure de données sont automatiquement détectés partout dans le code.

### Stratégie hybride de questions (OpenTDB + IA)

Le bot combine deux sources :

**OpenTDB (Open Trivia Database)** — Base gratuite avec +4000 questions vérifiées couvrant 24 catégories.

**Génération IA (Groq)** — Utilisée pour les sujets précis ou niche (ex: “WWII”, “NBA 1960s”).

**Pourquoi c’est important :** OpenTDB est rapide (~200ms) mais limité. L’IA est plus lente mais flexible.

### Machine à états

Les quiz utilisent des machines à états explicites :
`idle → awaiting_topic → awaiting_count → awaiting_difficulty → loading → in_progress → finished`

Cela évite les bugs de transitions invalides.

### PostgreSQL

Les achievements, stats et leaderboards sont persistés pour survivre aux redémarrages.

## Ce que démontre le projet

### 1. Intégration API hybride
- fallback OpenTDB → IA
- gestion des timeouts et rate limits
- validation des réponses

### 2. Multijoueur temps réel
- premier correct gagne
- gestion des race conditions
- cooldown anti-spam

### 3. Gamification
- 20 achievements
- score pondéré
- leaderboards globaux + catégories

### 4. Production-ready
- cache TTL
- sessions expirées automatiquement
- config par environnement
- gestion d’erreurs robuste

### 5. Telegram avancé
- inline keyboards
- édition de messages
- deep linking
- support groupes / privés

## Perspectives d'avenir et feuille de route

### Améliorations prévues

| Fonctionnalité | Description | Priorité |
|---------|-------------|----------|
| **Défis quotidiens** | Quiz du jour sélectionné avec des points bonus | Élevée |
| **Clans / Équipes** | Créer des groupes permanents avec des statistiques partagées et des classements de clans | Moyenne |
| **Réévaluation de la difficulté des questions** | Permettre aux utilisateurs d'évaluer la difficulté des questions après y avoir répondu ; utiliser les commentaires pour affiner les suggestions de l'IA | Moyenne |
| **Mode de répétition espacée** | Mode quiz qui répète les questions auxquelles les utilisateurs ont mal répondu, optimisé pour l'apprentissage | Faible |
| **Quiz vocaux** | Poser des questions via un message vocal, accepter les réponses vocales grâce à la reconnaissance vocale | Faible |
| **Tableau de bord Web** | Classements visuels, galerie des réalisations et historique des quiz | Moyenne |
| **Packs de questions personnalisés** | Packs de questions soumis par la communauté avec système de vote/vérification | Faible |

### Aperçu technique de la mise en place

**L'importance de la stratégie de mise en cache :** La mise en cache de 30 minutes des questions générées par l'IA a considérablement réduit les coûts d'API et la latence pour les sujets populaires. Cependant, la mise en cache par tuple `(sujet, nombre, difficulté)` n'est pas parfaite. Deux utilisateurs participant à un quiz sur la « Seconde Guerre mondiale » obtiennent les mêmes questions, ce qui réduit la variété. Une amélioration future consisterait à piocher dans un pool de cache plus large.

**Le timing des quiz en groupe est délicat :** le mécanisme « le premier à répondre correctement gagne » fonctionne bien pour l'engagement, mais crée un biais en faveur des utilisateurs disposant de connexions réseau plus rapides ou de temps de réponse des appareils plus courts. L'ajout d'un délai minimum de 2 secondes pour répondre ou la randomisation de l'ordre des réponses par utilisateur pourrait uniformiser les chances.

**Réglage de la température du LLM :** La température par défaut (créativité) pour la génération de questions a nécessité des essais. Trop faible → structures de questions répétitives. Trop élevée → erreurs factuelles. Actuellement réglée sur 0,7 sur la base de tests A/B avec 50 quiz échantillons.

**Mappage des catégories OpenTDB :** Le système de correspondance sujet → catégorie basé sur les expressions régulières fonctionne pour 80 % des cas d'utilisation, mais échoue sur les requêtes ambiguës (« Apple » pouvant désigner la technologie ou le fruit). Un futur classificateur basé sur le ML ou une étape de clarification par l'utilisateur améliorerait la précision.

### Considérations relatives à la scalabilité

L'architecture actuelle prend en charge jusqu'à environ 1 000 utilisateurs simultanés avec une seule instance PostgreSQL. Au-delà de cela :

- **Répartissez par chat_id** sur plusieurs instances de bot
- **Utilisez des répliques de lecture** pour les requêtes de classement
- **Utilisez Redis** pour l'état de session au lieu de cartes en mémoire
- **Mettez en file d'attente la génération d'IA** pour gérer les pics de trafic

## Configuration

```bash
cp .env.example .env   # remplissez vos jetons (voir ci-dessous)
npm install
npm run dev
```

Par défaut, le bot utilise le **long polling** : il peut recevoir les messages Telegram depuis un PC à domicile, sans URL publique ni port ouvert sur le routeur. Le long polling supprime un webhook Telegram existant tout en conservant les mises à jour en attente. Arrêtez toute autre instance de ce bot avant de le lancer ; Telegram n'autorise qu'un seul récepteur actif par jeton de bot.

Pour un déploiement hébergé avec webhook, définissez `WEBHOOK_URL` sur l'URL HTTPS publique de base de l'application (par exemple, `https://votre-app.example`). N'ajoutez pas `/webhook` ; le serveur ajoute ce chemin. Si `WEBHOOK_URL` est omis, le bot utilise le long polling.

**Variables d'environnement requises :**

| Variable | Où l'obtenir |
|----------|-----------------|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) sur Telegram |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) (formule gratuite disponible) |

**Facultatif :**

```env
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=postgresql://user:pass@localhost:5432/trivia
```

Parcourez les modèles sur [console.groq.com/docs/models](https://console.groq.com/docs/models). Le bot utilise par défaut `openai/gpt-oss-120b`.

## Commandes

| Commande | Description |
|---------|-------------|
| `/quiz` | Lancer un quiz en solo — demande le thème, le nombre de questions et le niveau de difficulté |
| `/gquiz` | Lancer un quiz en groupe dans une discussion de groupe |
| `/achievements` | Afficher vos badges obtenus |
| `/leaderboard` | Top 10 mondial |
| `/topleaderboard` | Meilleurs joueurs par catégorie |
| `/stats` | Vos statistiques cumulées |
| `/scoring` | Explication du système de notation |
| `/cancel` | Arrêter un quiz en cours |
| `/about` | À propos de ce bot |

## Niveaux de difficulté

🟢 Facile · 🟡 Moyen · 🔴 Difficile · 🎲 Aléatoire (choisi par l'IA pour chaque question)

La difficulté influe sur le multiplicateur de score : un quiz difficile parfaitement réussi rapporte jusqu'à 2 fois plus de points qu'un quiz facile. Répondre rapidement ajoute un bonus de vitesse supplémentaire (jusqu'à +30 % pour moins de 5 secondes par question).

## Système de notation

**Formule :** `Score = Précision × 1000 × Multiplicateur de difficulté × Bonus de vitesse × Bonus de perfection`

- **Précision :** nombre de bonnes réponses / nombre total de questions
- **Difficulté :** Facile (1,0x), Moyen (1,5x), Difficile (2,0x), Aléatoire (moyenne pondérée)
- **Vitesse :** <5 s en moyenne (+30 %), <10 s (+15 %), <20 s (+5 %)
- **Parfait :** bonus de +10 % pour une précision de 100 %

Consultez la commande `/scoring` dans le bot pour obtenir un détail complet.

## Succès

Il y a 20 succès à débloquer en mode solo et en mode groupe :

- Gagner 1 / 5 / 10 quiz en groupe
- Terminer 1 / 5 / 10 quiz en solo
- Obtenir un score parfait à un quiz de 5 / 10 / 15 / 20 questions
- Réaliser une moyenne inférieure à 20 / 10 / 5 secondes par question
- Réussir 3 quiz parfaits d'affilée
- Participer à 1 / 5 / 10 quiz en groupe
- Donner la première bonne réponse à la question 1 d'un quiz en groupe
- Se classer dans le top 5 du classement mondial
- Atteindre la 1re place dans n'importe quelle catégorie

## Structure du projet

```
tele-quiz-bot/
├── index.ts                # Point d'entrée du bot, gestionnaires de commandes, requêtes de rappel
├── triviaService.ts        # Récupération et mise en cache des questions (hybride OpenTDB + IA)
├── groq.ts           # Génération de questions par IA via l'API Groq
├── opentdb.ts              # Intégration de l'API OpenTDB + logique de correspondance des catégories
├── quiz.ts                 # Machine à états et gestion des sessions pour le quiz solo
├── groupquiz.ts            # Machine à états et gestion des sessions pour le quiz en groupe
├── achievements.ts         # Définition, suivi et affichage de 20 succès
├── leaderboard.ts          # Stockage et récupération du classement global et par catégorie
├── lifetimeStats.ts        # Suivi des statistiques à vie par utilisateur
├── scoring.ts              # Calcul du score pondéré (difficulté + rapidité + sans erreur)
├── config.ts               # Chargement des variables d'environnement et valeurs par défaut
├── server.ts               # Serveur HTTP pour les contrôles d'intégrité et les webhooks
├── db.ts                   # Pool de connexions PostgreSQL et requêtes
├── validation.ts           # Aides à la validation des entrées (sujets, pseudonymes, etc.)
├── logger.ts               # Utilitaire de journalisation structurée
├── tests/
│ ├── scoring.test.ts       # Tests unitaires de calcul du score
│ ├── leaderboard.test.ts   # Tests de classement et de départage
│ └── validation.test.ts    # Tests de validation des entrées
└── .env.example            # Modèle de variables d'environnement
```

## Pile technologique

- **[Telegraf](https://telegraf.js.org/)** — Framework pour bot Telegram
- **[Groq](https://groq.com)** — API d’inférence LLM rapide (formule gratuite disponible)
- **[OpenTDB](https://opentdb.com)** — Base de données gratuite de questions-réponses vérifiées par des humains
- **PostgreSQL** — Stockage persistant pour les scores, les statistiques et les succès
- **TypeScript + tsx** — S'exécute directement sans étape de compilation en développement
- **Vitest** — Tests unitaires pour la notation, le classement et la logique de validation

## Exécution des tests

```bash
npm test
```

Trois suites de tests couvrent la logique principale :

- **notation** — vérifie la formule de notation pondérée en tenant compte des multiplicateurs de difficulté, des bonus de vitesse et des cas limites tels que zéro question ou un score parfait
- **classement** — vérifie le classement, le dénouement des ex aequo et l'agrégation des scores
- **validation** — garantit que les entrées relatives au nombre de sujets/questions sont rejetées ou acceptées correctement

Pour exécuter avec couverture :

```bash
npm run test:coverage
```

## Contribuer

Les tickets et les pull requests sont les bienvenus. Pour les modifications importantes, veuillez d'abord ouvrir un ticket afin de discuter de ce que vous souhaitez modifier.

## Licence

MIT
