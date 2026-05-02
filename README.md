# Tele Quiz Bot

An AI-powered Telegram trivia bot. Ask it for a quiz on any topic, pick your difficulty, and compete with friends on the global leaderboard.

## How it works

The bot uses [OpenRouter](https://openrouter.ai) to generate fresh trivia questions on demand.

## Setup

```bash
cp .env.example .env   # fill in your tokens (see below)
npm install
npm run dev
```

**Required env vars:**

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
| `/quiz` | Start a solo quiz (prompts for topic, question count, and difficulty) |
| `/gquiz` | Start a group quiz in a group chat (prompts for topic, question count, and difficulty) |
| `/achievements` | View your earned badges |
| `/leaderboard` | Global top 10 |
| `/topleaderboard` | Top players by category |
| `/stats` | Your lifetime stats |
| `/cancel` | Stop an active quiz |

## Difficulty levels

🟢 Easy · 🟡 Medium · 🔴 Hard · 🎲 Random (AI picks per question)

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
│   ├── index.ts          # Main bot logic and command handlers
│   ├── openrouter.ts     # AI question generation
│   ├── quiz.ts           # Solo quiz state management
│   ├── groupquiz.ts      # Group quiz state management
│   ├── achievements.ts   # Achievement tracking
│   └── leaderboard.ts    # Leaderboard logic
├── server.ts             # Entry point
└── tele-bot-app/         # Doesn't affect the bot. React landing page (Vite)
```

## Tech stack

- **[Telegraf](https://telegraf.js.org/)** — Telegram bot framework
- **[OpenRouter](https://openrouter.ai)** — LLM API gateway (supports many free models)
- **TypeScript + tsx** — for dev, no build step needed
