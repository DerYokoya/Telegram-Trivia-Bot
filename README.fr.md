**Français** | [English](./README.md)

# Bot Telegram de Quiz

Un bot Telegram qui génère des questions de quiz sur n’importe quel sujet grâce à un LLM, avec modes solo et groupe, système de score, achievements et classements. Construit avec TypeScript, Telegraf et OpenRouter.

[![Utiliser le bot](https://img.shields.io/badge/Use-Bot-cyan?style=for-the-badge)](https://t.me/UraharaTriviaBot/)

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

Tu choisis un sujet, un nombre de questions et un niveau de difficulté. Le bot essaie d’abord de trouver le sujet dans [OpenTDB](https://opentdb.com). S’il ne trouve rien, il utilise [OpenRouter](https://openrouter.ai) pour générer des questions à la volée. Le score prend en compte la précision, la difficulté et la vitesse de réponse, puis peut être enregistré dans un classement global et par catégorie si l’utilisateur l’autorise.

## Choix de design

### Pourquoi TypeScript ?

TypeScript a été choisi pour plusieurs raisons importantes :

1. **Sécurité des types pour les machines à états complexes** — Les quiz solo et groupe gèrent des états complexes (question actuelle, résultats, timers, cooldowns). TypeScript garantit que les transitions sont valides et évite les erreurs runtime comme `null` ou `undefined`.

2. **Contrats d’API stricts** — Le bot interagit avec OpenRouter, OpenTDB et PostgreSQL. Les interfaces TypeScript définissent les formes exactes des réponses.

3. **Meilleure expérience développeur** — Autocomplétion, documentation inline et lisibilité améliorent la maintenabilité.

4. **Refactorisation plus sûre** — Les changements de structure de données sont automatiquement détectés partout dans le code.

### Stratégie hybride de questions (OpenTDB + IA)

Le bot combine deux sources :

**OpenTDB (Open Trivia Database)** — Base gratuite avec +4000 questions vérifiées couvrant 24 catégories.

**Génération IA (OpenRouter)** — Utilisée pour les sujets précis ou niche (ex: “WWII batailles”, “NBA 1960s”).

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

## Roadmap

| Feature | Description | Priorité |
|--------|-------------|----------|
| Daily Challenges | Quiz quotidien | Haute |
| Clans | Groupes persistants | Moyenne |
| Feedback difficulté | Ajustement IA | Moyenne |
| Spaced repetition | Révision des erreurs | Basse |
| Voice quizzes | Audio + STT | Basse |
| Dashboard web | Stats visuelles | Moyenne |
| Question packs | Contenu communautaire | Basse |

## Insights techniques

- Cache réduit les coûts mais limite la variété
- Group quiz favorise les connexions rapides
- Température IA optimale ~0.7
- Classification de sujets OpenTDB imparfaite (~80%)

## Scaling

Jusqu’à ~1000 users simultanés :

- shard par chat_id
- read replicas PostgreSQL
- Redis pour sessions
- queue pour IA

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

### Variables

| Variable | Source |
|----------|--------|
| TELEGRAM_BOT_TOKEN | @BotFather |
| OPENROUTER_API_KEY | openrouter.ai |

## Commands

| Command | Description |
|---------|-------------|
| /quiz | Quiz solo |
| /gquiz | Quiz groupe |
| /achievements | Badges |
| /leaderboard | Top global |
| /topleaderboard | Par catégorie |
| /stats | Stats utilisateur |
| /scoring | Explication score |
| /cancel | Stop quiz |
| /about | Infos bot |

## Difficulté

🟢 Easy · 🟡 Medium · 🔴 Hard · 🎲 Random

## Scoring

Score = Accuracy × 1000 × Difficulty × Speed × Bonus

## Achievements

- 20 achievements (solo + groupe)
- perfect scores
- streaks
- top rankings

## Structure

```
tele-quiz-bot/
├── index.ts
├── triviaService.ts
├── openrouter.ts
├── opentdb.ts
├── quiz.ts
├── groupquiz.ts
├── achievements.ts
├── leaderboard.ts
├── lifetimeStats.ts
├── scoring.ts
├── config.ts
├── server.ts
├── db.ts
├── validation.ts
├── logger.ts
└── tests/
```

## Tech stack

- Telegraf
- OpenRouter
- OpenTDB
- PostgreSQL
- TypeScript
- Vitest

## Tests

```bash
npm test
npm run test:coverage
```

## Contribuer

PRs welcome.

## License

MIT
```
