# Telegram Trivia Bot

A Telegram bot that generates trivia questions on any topic using an LLM, with solo and group play, a scoring system, achievements, and leaderboards. Built with TypeScript, Telegraf, and OpenRouter.

[![Use Bot](https://img.shields.io/badge/Use-Bot-cyan?style=for-the-badge)](https://t.me/UraharaTriviaBot/)

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

You pick a topic, question count, and difficulty. The bot calls [OpenRouter](https://openrouter.ai) to generate fresh questions on the spot. Scores factor in accuracy, difficulty, and response speed, then, if the user allows it, feed into a global leaderboard and per-category rankings.

## Setup

```bash
cp .env.example .env   # fill in your tokens (see below)
npm install
npm run dev
```

**Required environment variables:**

| Variable | Where to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram |
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) (free tier available) |

**Optional:**

```env
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
```

Browse free models at [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free). The bot defaults to `openai/gpt-oss-120b:free`.

## Commands

| Command | Description |
|---|---|
| `/quiz` | Start a solo quiz — prompts for topic, question count, and difficulty |
| `/gquiz` | Start a group quiz in a group chat |
| `/achievements` | View your earned badges |
| `/leaderboard` | Global top 10 |
| `/topleaderboard` | Top players by category |
| `/stats` | Your lifetime stats |
| `/cancel` | Stop an active quiz |

## Difficulty levels

🟢 Easy · 🟡 Medium · 🔴 Hard · 🎲 Random (AI picks per question)

Difficulty affects the score multiplier, so a perfect hard quiz scores up to 2× more than an easy one. Answering quickly adds a further speed bonus (up to +30% for under 5 seconds per question).

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
├── bot/
│   ├── index.ts          # Bot entry point and command handlers
│   ├── handlers.ts       # Shared message/callback handlers
│   ├── quiz.ts           # Solo quiz state machine
│   ├── groupquiz.ts      # Group quiz state machine
│   ├── openrouter.ts     # AI question generation
│   ├── achievements.ts   # Achievement definitions and tracking
│   ├── leaderboard.ts    # Global and category leaderboards
│   ├── lifetimeStats.ts  # Per-user stat tracking
│   ├── scoring.ts        # Score calculation logic
│   ├── triviaService.ts  # Question fetching/caching
│   ├── validation.ts     # Input validation helpers
│   ├── db.ts             # PostgreSQL connection
│   ├── config.ts         # Environment config
│   ├── health.ts         # Health check endpoint
│   └── logger.ts         # Logging utilities
├── tests/                # Vitest unit tests
├── server.ts             # HTTP server + bot init
└── tele-bot-app/         # React landing page (Vite, doesn't affect the bot)
```

## Tech stack

- **[Telegraf](https://telegraf.js.org/)** — Telegram bot framework
- **[OpenRouter](https://openrouter.ai)** — LLM API gateway (supports many free models)
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
