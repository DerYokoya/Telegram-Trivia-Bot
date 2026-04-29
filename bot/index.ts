import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { generateTriviaQuestions } from "./openrouter";
import {
  getSession,
  resetSession,
  formatDuration,
  type QuizSession,
} from "./quiz";
const lifetimeStats = new Map<number, { total: number; correct: number }>();
const COUNT_OPTIONS = [5, 10, 15, 20];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const LETTERS = ["A", "B", "C", "D"];

function buildQuestionText(session: QuizSession): string {
  const total = session.questions.length;
  const idx = session.currentIndex;
  const q = session.questions[idx];
  if (!q) return "";

  const header = `<b>Question ${idx + 1} of ${total}</b>`;
  const body = escapeHtml(q.question);
  const options = q.options
    .map((opt, i) => `<b>${LETTERS[i]}.</b> ${escapeHtml(opt)}`)
    .join("\n");
  return `${header}\n\n${body}\n\n${options}`;
}

function buildAnswerKeyboard(questionIndex: number) {
  return Markup.inlineKeyboard(
    LETTERS.map((letter, i) =>
      Markup.button.callback(letter, `ans:${questionIndex}:${i}`),
    ),
    { columns: 4 },
  );
}

function buildCountKeyboard() {
  return Markup.inlineKeyboard(
    COUNT_OPTIONS.map((n) => Markup.button.callback(String(n), `count:${n}`)),
    { columns: 4 },
  );
}

async function sendNextQuestion(ctx: Context, session: QuizSession) {
  const q = session.questions[session.currentIndex];
  if (!q) {
    await finishQuiz(ctx, session);
    return;
  }
  session.questionStartedAt = Date.now();
  const text = buildQuestionText(session);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...buildAnswerKeyboard(session.currentIndex),
  });
  session.activeMessageId = sent.message_id;
}

async function finishQuiz(ctx: Context, session: QuizSession) {
  session.phase = "finished";
  const total = session.results.length;
  const correct = session.results.filter((r) => r.isCorrect).length;
  const wrong = total - correct;
  const totalTime = session.quizStartedAt
    ? Date.now() - session.quizStartedAt
    : session.results.reduce((acc, r) => acc + r.timeMs, 0);
  const avg = total > 0 ? totalTime / total : 0;
  const fastest =
    session.results.length > 0
      ? Math.min(...session.results.map((r) => r.timeMs))
      : 0;
  const slowest =
    session.results.length > 0
      ? Math.max(...session.results.map((r) => r.timeMs))
      : 0;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  let verdict = "Keep practicing!";
  if (score === 100) verdict = "Flawless! You crushed it.";
  else if (score >= 80) verdict = "Great job!";
  else if (score >= 60) verdict = "Solid effort.";
  else if (score >= 40) verdict = "Not bad — room to grow.";

  const lines: string[] = [];
  lines.push(`<b>Recap — ${escapeHtml(session.topic ?? "Trivia")}</b>`);
  lines.push("");
  lines.push(`<b>Score:</b> ${correct}/${total} (${score}%)`);
  lines.push(`<b>Correct:</b> ${correct}   <b>Wrong:</b> ${wrong}`);
  lines.push(`<b>Total time:</b> ${formatDuration(totalTime)}`);
  lines.push(`<b>Average per question:</b> ${formatDuration(avg)}`);
  if (total > 0) {
    lines.push(
      `<b>Fastest:</b> ${formatDuration(fastest)}   <b>Slowest:</b> ${formatDuration(slowest)}`,
    );
  }
  lines.push("");
  lines.push(`<i>${verdict}</i>`);
  lines.push("");
  lines.push("<b>Question breakdown:</b>");

  session.results.forEach((r, i) => {
    const mark = r.isCorrect ? "✅" : r.selectedIndex === null ? "⏭️" : "❌";
    const correctLetter = LETTERS[r.correctIndex];
    const yourLetter =
      r.selectedIndex !== null ? LETTERS[r.selectedIndex] : "—";
    lines.push("");
    lines.push(`${mark} <b>Q${i + 1}.</b> ${escapeHtml(r.question)}`);
    lines.push(
      `   Your answer: <b>${yourLetter}</b>   Correct: <b>${correctLetter}</b>   Time: ${formatDuration(r.timeMs)}`,
    );
    const expl = session.questions[i]?.explanation;
    if (expl) {
      lines.push(`   <i>${escapeHtml(expl)}</i>`);
    }
  });

  lines.push("");
  lines.push("Send /quiz to play again.");

  const recap = lines.join("\n");

  const chunks = chunkText(recap, 3500);
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }

  // Update lifetime stats
  const stats = lifetimeStats.get(session.chatId) ?? { total: 0, correct: 0 };
  stats.total += total;
  stats.correct += correct;
  lifetimeStats.set(session.chatId, stats);
}

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const lines = text.split("\n");
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (buf.length + line.length + 1 > max) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function startTelegramBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set; Telegram bot disabled.");
    return;
  }

  const bot = new Telegraf(token);

  bot.telegram.setMyCommands([
    { command: "quiz", description: "Start a new trivia quiz" },
    { command: "cancel", description: "Cancel the current quiz" },
    { command: "help", description: "Show help information" },
    { command: "stats", description: "Show your quiz stats" },
    { command: "about", description: "About this bot" },
  ]);

  bot.start(async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(
      "Welcome to Trivia Bot!\n\n" +
        "I generate AI-powered trivia quizzes on any topic you want.\n\n" +
        "Commands:\n" +
        "/quiz — start a new quiz\n" +
        "/cancel — stop the current quiz\n" +
        "/help — show this message",
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "How it works:\n\n" +
        "1. Send /quiz\n" +
        "2. Tell me a topic (anything: 'space exploration', '90s hip hop', 'Roman emperors')\n" +
        "3. Choose how many questions\n" +
        "4. Tap your answer for each question\n" +
        "5. Get a full recap with your score and times\n\n" +
        "Use /cancel anytime to stop.",
    );
  });

  bot.command("cancel", async (ctx) => {
    const session = getSession(ctx.chat.id);
    if (session.phase === "idle") {
      await ctx.reply("Nothing to cancel. Send /quiz to start.");
      return;
    }
    resetSession(ctx.chat.id);
    await ctx.reply("Quiz cancelled. Send /quiz to start a new one.");
  });

  bot.command("quiz", async (ctx) => {
    const session = resetSession(ctx.chat.id);
    session.phase = "awaiting_topic";
    await ctx.reply(
      "Great! What topic do you want to be quizzed on?\n\n" +
        "Examples: 'World War II', 'Greek mythology', 'NBA history', 'Quantum physics'",
    );
  });

  bot.command("stats", async (ctx) => {
    const stats = lifetimeStats.get(ctx.chat.id);

    if (!stats || stats.total === 0) {
      await ctx.reply("No stats yet — play a quiz first using /quiz!");
      return;
    }

    const score = Math.round((stats.correct / stats.total) * 100);

    await ctx.reply(
      `<b>Your Lifetime Stats</b>\n\n` +
        `<b>Total questions answered:</b> ${stats.total}\n` +
        `<b>Correct:</b> ${stats.correct}\n` +
        `<b>Score:</b> ${score}%\n`,
      { parse_mode: "HTML" },
    );
  });

  bot.command("about", async (ctx) => {
    await ctx.reply(
      "🤖 <b>Trivia Bot</b>\n" +
        "AI‑generated trivia on any topic.\n\n" +
        "Built with Telegraf + OpenRouter.\n" +
        "by DerYokoya.\n\n" +
        "Send /quiz to begin!",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.url("🌐 GitHub", "https://github.com/DerYokoya"),
        ]),
      },
    );
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const session = getSession(ctx.chat.id);

    if (session.phase === "awaiting_topic") {
      if (text.length < 2 || text.length > 120) {
        await ctx.reply("Please enter a topic between 2 and 120 characters.");
        return;
      }
      session.topic = text;
      session.phase = "awaiting_count";
      await ctx.reply(
        `Topic: <b>${escapeHtml(text)}</b>\n\nHow many questions?`,
        { parse_mode: "HTML", ...buildCountKeyboard() },
      );
      return;
    }

    if (session.phase === "in_progress") {
      await ctx.reply(
        "Tap one of the answer buttons on the current question, or send /cancel to stop.",
      );
      return;
    }

    if (session.phase === "idle" || session.phase === "finished") {
      await ctx.reply("Send /quiz to start a new trivia round.");
    }
  });

  bot.action(/^count:(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const count = Number(match[1]);
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getSession(chatId);

    if (session.phase !== "awaiting_count" || !session.topic) {
      await ctx.answerCbQuery("That choice is no longer active.");
      return;
    }

    if (!COUNT_OPTIONS.includes(count)) {
      await ctx.answerCbQuery("Invalid count.");
      return;
    }

    await ctx.answerCbQuery(`${count} questions selected`);
    session.desiredCount = count;
    session.phase = "loading";

    try {
      await ctx.editMessageText(
        `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${count}</b>\n\nGenerating questions…`,
        { parse_mode: "HTML" },
      );
    } catch {
      // ignore edit errors (message too old, etc.)
    }

    try {
      const questions = await generateTriviaQuestions(session.topic, count);
      session.questions = questions;
      session.currentIndex = 0;
      session.results = [];
      session.phase = "in_progress";
      session.quizStartedAt = Date.now();
      await ctx.reply(
        `Ready! ${questions.length} questions on <b>${escapeHtml(session.topic)}</b>. Timer starts now.`,
        { parse_mode: "HTML" },
      );
      await sendNextQuestion(ctx, session);
    } catch (err) {
      console.error("Failed to generate questions:", err);
      resetSession(chatId);
      await ctx.reply(
        "Sorry, I couldn't generate questions right now. Please try /quiz again.",
      );
    }
  });

  bot.action(/^ans:(\d+):(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const qIndex = Number(match[1]);
    const choice = Number(match[2]);
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getSession(chatId);

    if (session.phase !== "in_progress") {
      await ctx.answerCbQuery("This question is no longer active.");
      return;
    }

    if (qIndex !== session.currentIndex) {
      await ctx.answerCbQuery("Already answered.");
      return;
    }

    const question = session.questions[qIndex];
    if (!question) {
      await ctx.answerCbQuery("Question missing.");
      return;
    }

    const elapsed = session.questionStartedAt
      ? Date.now() - session.questionStartedAt
      : 0;
    const isCorrect = choice === question.correctIndex;

    session.results.push({
      question: question.question,
      selectedIndex: choice,
      correctIndex: question.correctIndex,
      isCorrect,
      timeMs: elapsed,
    });

    await ctx.answerCbQuery(isCorrect ? "Correct! ✅" : "Wrong ❌");

    const correctLetter = LETTERS[question.correctIndex];
    const yourLetter = LETTERS[choice];
    const verdict = isCorrect
      ? `✅ Correct! (${formatDuration(elapsed)})`
      : `❌ Wrong. You picked <b>${yourLetter}</b>, correct was <b>${correctLetter}</b>. (${formatDuration(elapsed)})`;

    const updated =
      buildQuestionText(session) +
      `\n\n${verdict}` +
      (question.explanation
        ? `\n<i>${escapeHtml(question.explanation)}</i>`
        : "");

    try {
      await ctx.editMessageText(updated, { parse_mode: "HTML" });
    } catch {
      // ignore
    }

    session.currentIndex += 1;
    if (session.currentIndex >= session.questions.length) {
      await finishQuiz(ctx, session);
    } else {
      await sendNextQuestion(ctx, session);
    }
  });

  bot.catch((err, ctx) => {
    console.error("Telegraf error:", err, ctx.update);
  });

  bot.launch().catch((err) => {
    console.error("Failed to launch Telegram bot:", err);
    process.exit(1);
  });

  console.log("✅ Telegram trivia bot started");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
