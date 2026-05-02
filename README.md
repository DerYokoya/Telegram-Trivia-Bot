# Tele Quiz Bot

AI-powered Telegram trivia bot built with Telegraf + OpenRouter.

## Setup

1. `cp .env.example .env` and fill in your tokens
2. `npm install`
3. `npm run dev`

## Commands

- `/quiz` — solo quiz (topic → count → difficulty)
- `/gquiz` — group quiz in group chats
- `/achievements` — view earned badges
- `/leaderboard` — global top 10
- `/topleaderboard` — category leaderboard
- `/stats` — lifetime stats
- `/cancel` — stop quiz

## Difficulty

🟢 Easy · 🟡 Medium · 🔴 Hard · 🎲 Random (AI assigns per question)

## Achievements (20 total)

- Win 1/5/10 gquizzes
- Complete 1/5/10 solo quizzes
- Perfect score on 5/10/15/20-question quiz
- Sub 20s/10s/5s average per question
- 3 perfect quizzes streak
- Participate in 1/5/10 gquizzes
- First correct answer on Q1 in gquiz
- Top 5 global leaderboard
- Top 1 in any category
