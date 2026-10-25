[Français](./README.fr.md) | **English**

# Telegram Trivia Bot

A Telegram bot that generates trivia questions on any topic using an LLM, with solo and group play, a scoring system, achievements, and leaderboards. Built with TypeScript, Telegraf, and Groq.

## Video Showcase

https://github.com/user-attachments/assets/e5f86bf1-aa36-40b8-bb08-26849f96e006

### Test

https://github.com/user-attachments/assets/138c8353-daff-4261-98e0-4ceb87942f23

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img width="250" alt="Tele-Bot-1" src="https://github.com/user-attachments/assets/7d8f43fc-5c17-448d-8acb-d28b82135b4d" /><br />
        <sub><b>Interface preview (Start)</b></sub>
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

## How it works

You pick a topic, question count, and difficulty. The bot first tries to find the topic in [OpenTDB](https://opentdb.com). If it doesn't find it, it calls [Groq](https://groq.com) to generate fresh questions on the spot. Scores factor in accuracy, difficulty, and response speed, then, if the user allows it, feed into a global leaderboard and per-category rankings.

## Design Choices

### Why TypeScript?

TypeScript was chosen for several critical reasons:

1. **Type Safety for Complex State Machines** — Both solo and group quizzes maintain complex state (current question, results, timers, cooldowns). TypeScript ensures state transitions are valid and prevents runtime errors like accessing properties on `null` or `undefined`.

2. **API Contract Enforcement** — The bot interacts with multiple external services (Groq API, OpenTDB, PostgreSQL). TypeScript interfaces define exact response shapes, catching mismatches before production.

3. **Better Developer Experience** — With 20 achievement types, leaderboard entry shapes, and quiz session objects, TypeScript's autocomplete and inline documentation make the codebase maintainable.

4. **Refactoring Confidence** — When changing a data structure (e.g., adding a `difficulty` field to questions), TypeScript flags every usage site, preventing silent bugs.

### Dual Question Source Strategy (OpenTDB + AI)

The bot implements a hybrid approach to question fetching, prioritizing performance without sacrificing specificity:

**OpenTDB (Open Trivia Database)** — A free API with 4,000+ human-verified, fact-checked questions across 24 fixed categories (History, Science, Sports, etc.). Used when the user's topic exactly matches a category (e.g., "History", "Music").

**AI Generation (Groq)** — Used for specific sub-topics (e.g., "WWII", "NBA 1960s", "Greek Mythology") where OpenTDB would return off-topic questions from the broader category.

**Why this matters:** OpenTDB responds in ~200ms with vetted content, but can't handle niche topics. AI generation takes longer (the time depends on what model is used) but can target anything. The hybrid approach gives users fast responses for common topics, with precise coverage for obscure ones.

### State Machine Design

Both solo and group quizzes use explicit state machines (`idle` → `awaiting_topic` → `awaiting_count` → `awaiting_difficulty` → `loading` → `in_progress` → `finished`). This prevents edge cases like answering a question after the quiz ended or starting a new quiz while one is active.

### PostgreSQL for Persistence

Achievements, leaderboards, and lifetime stats are stored in PostgreSQL rather than in-memory to survive bot restarts and scale across multiple instances.

## What This Project Demonstrates

### 1. **Hybrid API Integration**
- Graceful fallback between data sources (OpenTDB → AI)
- Rate limiting and timeout handling for external APIs
- Response validation and sanitization across different data formats

### 2. **Real-Time Multiplayer Mechanics**
- First-correct-wins group quiz system with per-question timers
- Cooldown management to prevent spam in group settings
- Race condition handling using atomic answer registration

### 3. **Gamification & Engagement Systems**
- 20 achievements with progressive unlock conditions
- Weighted scoring algorithm factoring accuracy, difficulty, and speed
- Global + category-specific leaderboards with tie-breaking

### 4. **Production-Ready Patterns**
- In-memory caching with TTL for expensive AI generation
- Session management with cleanup and expiration
- Environment-based configuration and feature toggling
- Comprehensive error handling without crashing the bot
- Rate limiting per user and per chat

### 5. **Telegram Platform Mastery**
- Inline keyboards for interactive flow
- Message editing for seamless transitions
- Command menus and deep linking
- Group vs private chat awareness

## Future Insights & Roadmap

### Planned Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Daily Challenges** | Curated quiz of the day with bonus points | High |
| **Clans / Teams** | Create persistent groups with shared stats and clan leaderboards | Medium |
| **Question Difficulty Re-evaluation** | Let users rate question difficulty after answering; use feedback to tune AI prompts | Medium |
| **Spaced Repetition Mode** | Quiz mode that repeats questions users got wrong, optimized for learning | Low |
| **Voice Quizzes** | Ask questions via voice message, accept voice answers with speech-to-text | Low |
| **Web Dashboard** | Visual leaderboards, achievement gallery, and quiz history viewer | Medium |
| **Custom Question Packs** | Community-submitted question packs with voting/verification system | Low |

### Technical Insights from Building This

**Caching Strategy Matters:** The 30-minute cache on AI-generated questions significantly reduced API costs and latency for popular topics. However, caching per `(topic, count, difficulty)` tuple isn't perfect. Two users quizzing on "WWII" get the same questions, reducing variety. A future improvement would shuffle from a larger cached pool.

**Group Quiz Timing is Tricky:** The first-correct-wins mechanic works well for engagement but creates a bias toward users with faster network connections or device response times. Adding a 2-second minimum answer window or randomizing answer order per user could level the playing field.

**LLM Temperature Tuning:** The default temperature (creativity) for question generation required experimentation. Too low → repetitive question structures. Too high → factual errors. Currently set to 0.7 based on A/B testing with 50 sample quizzes.

**OpenTDB Category Mapping:** The regex-based topic → category matcher works for 80% of use cases but fails on ambiguous queries ("Apple" could be tech or fruit). A future ML-based classifier or user clarification step would improve accuracy.

### Scaling Considerations

The current architecture supports up to ~1,000 concurrent users with a single PostgreSQL instance. Beyond that:

- **Shard by chat_id** across multiple bot instances
- **Read replicas** for leaderboard queries
- **Redis** for session state instead of in-memory maps
- **Queue AI generation** to handle burst traffic

## Setup

```bash
cp .env.example .env   # fill in your tokens (see below)
npm install
npm run dev
```

**Required environment variables:**

| Variable | Where to get it |
|----------|-----------------|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) (free tier available) |

**Optional:**

```env
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=postgresql://user:pass@localhost:5432/trivia
```

Browse models at [console.groq.com/docs/models](https://console.groq.com/docs/models). The bot defaults to `openai/gpt-oss-120b`.

## Commands

| Command | Description |
|---------|-------------|
| `/quiz` | Start a solo quiz — prompts for topic, question count, and difficulty |
| `/gquiz` | Start a group quiz in a group chat |
| `/achievements` | View your earned badges |
| `/leaderboard` | Global top 10 |
| `/topleaderboard` | Top players by category |
| `/stats` | Your lifetime stats |
| `/scoring` | Explanation of the scoring system |
| `/cancel` | Stop an active quiz |
| `/about` | About this bot |

## Difficulty levels

🟢 Easy · 🟡 Medium · 🔴 Hard · 🎲 Random (AI picks per question)

Difficulty affects the score multiplier, so a perfect hard quiz scores up to 2× more than an easy one. Answering quickly adds a further speed bonus (up to +30% for under 5 seconds per question).

## Scoring System

**Formula:** `Score = Accuracy × 1000 × Difficulty Multiplier × Speed Bonus × Perfect Bonus`

- **Accuracy:** correct / total questions
- **Difficulty:** Easy (1.0x), Medium (1.5x), Hard (2.0x), Random (weighted average)
- **Speed:** <5s avg (+30%), <10s (+15%), <20s (+5%)
- **Perfect:** +10% bonus for 100% accuracy

See `/scoring` in the bot for a detailed breakdown.

## Achievements

There are 20 achievements to unlock across solo and group play:

- Win 1 / 5 / 10 group quizzes
- Complete 1 / 5 / 10 solo quizzes
- Perfect score on a 5 / 10 / 15 / 20-question quiz
- Average under 20s / 10s / 5s per question
- 3 perfect quizzes in a row
- Participate in 1 / 5 / 10 group quizzes
- First correct answer on Q1 in a group quiz
- Reach top 5 on the global leaderboard
- Reach #1 in any category

## Project structure

```
tele-quiz-bot/
├── index.ts                # Bot entry point, command handlers, callback queries
├── triviaService.ts        # Question fetching/caching (OpenTDB + AI hybrid)
├── groq.ts           # AI question generation via Groq API
├── opentdb.ts              # OpenTDB API integration + category matching logic
├── quiz.ts                 # Solo quiz state machine and session management
├── groupquiz.ts            # Group quiz state machine and session management
├── achievements.ts         # 20 achievement definitions, tracking, and rendering
├── leaderboard.ts          # Global and category leaderboard storage/retrieval
├── lifetimeStats.ts        # Per-user lifetime statistics tracking
├── scoring.ts              # Weighted score calculation (difficulty + speed + perfect)
├── config.ts               # Environment variable loading and defaults
├── server.ts               # HTTP server for health checks and webhooks
├── db.ts                   # PostgreSQL connection pool and queries
├── validation.ts           # Input validation helpers (topics, nicknames, etc.)
├── logger.ts               # Structured logging utility
├── tests/
│ ├── scoring.test.ts       # Score calculation unit tests
│ ├── leaderboard.test.ts   # Leaderboard ranking and tie-breaking tests
│ └── validation.test.ts    # Input validation tests
└── .env.example            # Environment variable template
```

## Tech stack

- **[Telegraf](https://telegraf.js.org/)** — Telegram bot framework
- **[Groq](https://groq.com)** — Fast LLM inference API (free tier available)
- **[OpenTDB](https://opentdb.com)** — Free, human-verified trivia database
- **PostgreSQL** — persistent storage for scores, stats, and achievements
- **TypeScript + tsx** — runs directly without a build step in dev
- **Vitest** — unit tests for scoring, leaderboard, and validation logic

## Running tests

```bash
npm test
```

Three test suites cover the core logic:

- **scoring** — verifies the weighted score formula across difficulty multipliers, speed bonuses, and edge cases like zero questions or a perfect score
- **leaderboard** — checks ranking, tie-breaking, and score aggregation
- **validation** — ensures topic/question-count inputs are rejected or accepted correctly

To run with coverage:

```bash
npm run test:coverage
```

## Contributing

Issues and pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

## License

MIT
