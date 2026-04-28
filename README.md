# Telegram Trivia Quiz Bot

An AI-powered Telegram bot that generates trivia quizzes on any topic, using [OpenRouter](https://openrouter.ai) for free AI requests. In order to use it, visit [Urahara Trivia](https://t.me/UraharaTriviaBot)

## What it does

- You send `/quiz` and pick a topic — anything: history, science, sports, pop culture
- Choose 5, 10, 15, or 20 questions
- The bot generates questions live using AI and sends them one at a time with inline buttons
- Each answer is timed
- At the end you get a full recap: score, per-question breakdown, correct answers, explanations, and time stats

## Setup

### 1. Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow the prompts (give it a name and username)
4. Copy the **token** it gives you — looks like `123456789:ABCdef...`

### 2. Get an OpenRouter API key

1. Go to [openrouter.ai](https://openrouter.ai) and sign up (free, no credit card needed)
2. Go to **Keys** in your account and create a new key
3. Copy the key — looks like `sk-or-v1-...`

OpenRouter gives you access to many free AI models. The bot uses `meta-llama/llama-3.3-8b-instruct:free` by default, which is fast and completely free.

### 3. Configure your environment

Copy the example env file and fill it in:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder values:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdef_your_actual_token_here
OPENROUTER_API_KEY=sk-or-v1-your_actual_key_here
```

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

You should see: `✅ Telegram trivia bot started`

Open Telegram, find your bot, and send `/start`.

## Changing the AI model

The default model is free. If you want better quality, set `OPENROUTER_MODEL` in your `.env`:

```
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
```

Browse all free models at [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free).

## Project structure

```
tele-quiz-bot/
├── bot/
│   ├── index.ts        # All Telegram command/action handlers
│   ├── openrouter.ts   # Calls OpenRouter API to generate questions
│   └── quiz.ts         # In-memory session state per chat
├── server.ts           # Entry point — just starts the bot
├── package.json
├── tsconfig.json
├── .env.example        # Template for env vars
├── .env                # Secrets
└── tele-bot-app/       # Vite + React scaffold (unused)
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/quiz` | Start a new quiz |
| `/cancel` | Stop the current quiz |
| `/help` | How to use the bot |

## Deploying

The bot uses long-polling — no public URL or webhook needed.

**Railway** (easiest free option):
1. Push to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add your env vars under **Variables**

**Your own machine / VPS**:
```bash
npm run build
npm start
```

## Troubleshooting

**`OPENROUTER_API_KEY environment variable is required`** — your `.env` file isn't being loaded. Make sure it's named exactly `.env` (not `.env.txt`), is in the same folder as `package.json`, and you're running `npm run dev`.

**Bot doesn't respond** — double-check your `TELEGRAM_BOT_TOKEN`. Message @BotFather → `/mybots` → select your bot → **API Token**.

**AI returns no questions** — try a different free model via `OPENROUTER_MODEL`.
ENDOFFILE
echo "done"