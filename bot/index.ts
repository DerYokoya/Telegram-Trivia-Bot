import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { generateTriviaQuestions } from "./openrouter";
import {
  getSession,
  resetSession,
  formatDuration,
  type QuizSession,
} from "./quiz";
import {
  getGroupSession,
  resetGroupSession,
  registerGroupAnswer,
  getStandings,
  type GroupQuizSession,
} from "./groupquiz";
import {
  recordResult,
  getGlobalLeaderboard,
  getCategoryLeaderboard,
  type LeaderboardEntry,
} from "./leaderboard";

// ─── Constants ────────────────────────────────────────────────────────────────

const lifetimeStats = new Map<number, { total: number; correct: number }>();
const COUNT_OPTIONS = [5, 10, 15, 20];
const LETTERS = ["A", "B", "C", "D"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isGroupChat(ctx: Context): boolean {
  const type = ctx.chat?.type;
  return type === "group" || type === "supergroup" || type === "channel";
}

function getSenderName(ctx: Context): string {
  const from = (ctx as any).from;
  if (!from) return "Unknown";
  if (from.first_name && from.last_name)
    return `${from.first_name} ${from.last_name}`;
  if (from.first_name) return from.first_name;
  if (from.username) return `@${from.username}`;
  return `User ${from.id}`;
}

function buildQuestionText(
  questions: { question: string; options: string[] }[],
  idx: number,
): string {
  const total = questions.length;
  const q = questions[idx];
  if (!q) return "";
  const header = `<b>Question ${idx + 1} of ${total}</b>`;
  const body = escapeHtml(q.question);
  const options = q.options
    .map((opt, i) => `<b>${LETTERS[i]}.</b> ${escapeHtml(opt)}`)
    .join("\n");
  return `${header}\n\n${body}\n\n${options}`;
}

function buildAnswerKeyboard(questionIndex: number, prefix: "ans" | "gans") {
  return Markup.inlineKeyboard(
    LETTERS.map((letter, i) =>
      Markup.button.callback(letter, `${prefix}:${questionIndex}:${i}`),
    ),
    { columns: 4 },
  );
}

function buildCountKeyboard(prefix: "count" | "gcount") {
  return Markup.inlineKeyboard(
    COUNT_OPTIONS.map((n) =>
      Markup.button.callback(String(n), `${prefix}:${n}`),
    ),
    { columns: 4 },
  );
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

// ─── Medal helpers ────────────────────────────────────────────────────────────

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

// ─── Leaderboard rendering ────────────────────────────────────────────────────

function renderLeaderboard(
  entries: LeaderboardEntry[],
  title: string,
): string {
  if (entries.length === 0) {
    return `<b>${escapeHtml(title)}</b>\n\nNo entries yet. Play a quiz to be the first!`;
  }

  const rows = entries.map((e, i) => {
    const pct =
      e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
    const speed = formatDuration(e.avgSpeedMs);
    return (
      `${medal(i + 1)} <b>${escapeHtml(e.nickname)}</b>\n` +
      `   📚 ${escapeHtml(e.topic)}  ·  ✅ ${e.correct}/${e.total} (${pct}%)  ·  ⚡ avg ${speed}`
    );
  });

  return `<b>${escapeHtml(title)}</b>\n\n${rows.join("\n\n")}`;
}

// ─── Solo quiz helpers ────────────────────────────────────────────────────────

async function sendNextSoloQuestion(ctx: Context, session: QuizSession) {
  const q = session.questions[session.currentIndex];
  if (!q) {
    await finishSoloQuiz(ctx, session);
    return;
  }
  session.questionStartedAt = Date.now();
  const text = buildQuestionText(session.questions, session.currentIndex);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...buildAnswerKeyboard(session.currentIndex, "ans"),
  });
  session.activeMessageId = sent.message_id;
}

async function finishSoloQuiz(ctx: Context, session: QuizSession) {
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
    if (expl) lines.push(`   <i>${escapeHtml(expl)}</i>`);
  });

  lines.push("");
  lines.push("Send /quiz to play again.");

  for (const chunk of chunkText(lines.join("\n"), 3500)) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }

  // Update lifetime stats
  const stats = lifetimeStats.get(session.chatId) ?? { total: 0, correct: 0 };
  stats.total += total;
  stats.correct += correct;
  lifetimeStats.set(session.chatId, stats);

  // Prompt for nickname to register on leaderboard
  session.phase = "awaiting_nickname";
  await ctx.reply(
    "🏆 <b>Want to save your result to the leaderboard?</b>\n\n" +
      "Reply with a nickname (up to 24 chars), or /skip to skip.",
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("⏭ Skip", "skip_nickname"),
      ]),
    },
  );
}

// ─── Group quiz helpers ───────────────────────────────────────────────────────

async function sendNextGroupQuestion(
  ctx: Context,
  session: GroupQuizSession,
) {
  const q = session.questions[session.currentIndex];
  if (!q) {
    await finishGroupQuiz(ctx, session);
    return;
  }

  // Initialise the result slot BEFORE sending (so answers can be registered)
  session.results[session.currentIndex] = {
    questionIndex: session.currentIndex,
    winnerId: null,
    winnerName: null,
    winnerElapsedMs: null,
    correctIndex: q.correctIndex,
    allAnswers: new Map(),
  };

  session.questionStartedAt = Date.now();
  const text = buildQuestionText(session.questions, session.currentIndex);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...buildAnswerKeyboard(session.currentIndex, "gans"),
  });
  session.activeMessageId = sent.message_id;
}

async function finishGroupQuiz(ctx: Context, session: GroupQuizSession) {
  session.phase = "finished";

  const standings = getStandings(session);
  const total = session.questions.length;

  const lines: string[] = [];
  lines.push(
    `🏆 <b>Quiz Over — ${escapeHtml(session.topic ?? "Trivia")}</b>`,
  );
  lines.push("");

  if (standings.length === 0) {
    lines.push("Nobody answered. Better luck next time!");
  } else {
    // Determine ties at the top
    const topCorrect = standings[0]!.correct;
    const topAvg =
      standings[0]!.correct > 0
        ? standings[0]!.totalCorrectMs / standings[0]!.correct
        : Infinity;

    lines.push("<b>Final Standings:</b>");
    lines.push("");

    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      const p = standings[i]!;
      const prev = standings[i - 1];
      if (
        prev &&
        (p.correct !== prev.correct ||
          p.totalCorrectMs / Math.max(p.correct, 1) !==
            prev.totalCorrectMs / Math.max(prev.correct, 1))
      ) {
        rank = i + 1;
      }
      const avgMs =
        p.correct > 0 ? p.totalCorrectMs / p.correct : 0;
      const pct = total > 0 ? Math.round((p.correct / total) * 100) : 0;
      lines.push(
        `${medal(rank)} <b>${escapeHtml(p.displayName)}</b>` +
          `  ✅ ${p.correct}/${total} (${pct}%)` +
          (p.correct > 0 ? `  ⚡ avg ${formatDuration(avgMs)}` : ""),
      );
    }

    // Winners announcement
    lines.push("");
    const winners = standings.filter(
      (p) =>
        p.correct === topCorrect &&
        (topCorrect === 0 ||
          p.totalCorrectMs / p.correct === topAvg),
    );

    if (winners.length === 1) {
      lines.push(
        `🎉 Winner: <b>${escapeHtml(winners[0]!.displayName)}</b>!`,
      );
    } else if (winners.length > 1 && topCorrect > 0) {
      const names = winners.map((w) => escapeHtml(w.displayName)).join(", ");
      lines.push(`🤝 It's a tie between <b>${names}</b>!`);
    }
  }

  lines.push("");
  lines.push("<b>Question-by-question winners:</b>");
  session.results.forEach((r, i) => {
    const q = session.questions[i];
    if (!q) return;
    const correctLetter = LETTERS[r.correctIndex]!;
    if (r.winnerId !== null) {
      lines.push(
        `  Q${i + 1}: 🏅 <b>${escapeHtml(r.winnerName ?? "")}</b>` +
          ` (${formatDuration(r.winnerElapsedMs ?? 0)})` +
          ` — Answer: <b>${correctLetter}</b>`,
      );
    } else {
      lines.push(
        `  Q${i + 1}: No correct answer — Answer: <b>${correctLetter}</b>`,
      );
    }
    if (q.explanation) lines.push(`       <i>${escapeHtml(q.explanation)}</i>`);
  });

  lines.push("");
  lines.push("Send /gquiz to play again!");

  for (const chunk of chunkText(lines.join("\n"), 3500)) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }

  // Auto-record top participants to global leaderboard using their Telegram display name
  for (const p of standings) {
    if (p.correct === 0) continue;
    const avgSpeedMs = p.totalCorrectMs / p.correct;
    recordResult({
      userId: p.userId,
      nickname: p.displayName,
      topic: session.topic ?? "Trivia",
      category: (session.topic ?? "trivia").toLowerCase().trim(),
      correct: p.correct,
      total,
      avgSpeedMs,
      recordedAt: Date.now(),
    });
  }
}

// ─── Bot setup ────────────────────────────────────────────────────────────────

export function startTelegramBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set; Telegram bot disabled.");
    return;
  }

  const bot = new Telegraf(token);

  bot.telegram.setMyCommands([
    { command: "quiz", description: "Start a solo trivia quiz" },
    { command: "gquiz", description: "Start a group trivia quiz" },
    { command: "cancel", description: "Cancel the current quiz" },
    { command: "leaderboard", description: "Global all-topics leaderboard" },
    { command: "topleaderboard", description: "Leaderboard for a topic" },
    { command: "stats", description: "Your personal quiz stats" },
    { command: "help", description: "Show help information" },
    { command: "about", description: "About this bot" },
  ]);

  // ── /start ──────────────────────────────────────────────────────────────────

  bot.start(async (ctx) => {
    resetSession(ctx.chat.id);
    await ctx.reply(
      "Welcome to Trivia Bot! 🎉\n\n" +
        "AI-powered trivia on any topic.\n\n" +
        "<b>Solo:</b> /quiz\n" +
        "<b>Group competition:</b> /gquiz  (use in a group chat)\n\n" +
        "Other commands:\n" +
        "/leaderboard — global leaderboard\n" +
        "/topleaderboard — leaderboard by topic/category\n" +
        "/stats — your personal stats\n" +
        "/cancel — stop current quiz\n" +
        "/help — detailed help",
      { parse_mode: "HTML" },
    );
  });

  // ── /help ───────────────────────────────────────────────────────────────────

  bot.help(async (ctx) => {
    await ctx.reply(
      "<b>Solo (/quiz)</b>\n" +
        "1. Send /quiz\n" +
        "2. Enter a topic\n" +
        "3. Choose question count\n" +
        "4. Tap your answer\n" +
        "5. Get a full recap + option to save to leaderboard\n\n" +
        "<b>Group (/gquiz)</b> — use in a group/supergroup\n" +
        "1. Send /gquiz\n" +
        "2. Anyone (or the host) enters the topic\n" +
        "3. Choose question count\n" +
        "4. First correct tap wins each question\n" +
        "5. Leaderboard shown at the end\n\n" +
        "<b>Leaderboards</b>\n" +
        "/leaderboard — top 10 all-time across all topics\n" +
        "/topleaderboard — top 10 for a specific category\n\n" +
        "Use /cancel anytime to stop.",
      { parse_mode: "HTML" },
    );
  });

  // ── /cancel ─────────────────────────────────────────────────────────────────

  bot.command("cancel", async (ctx) => {
    if (isGroupChat(ctx)) {
      const from = (ctx as any).from;
      if (!from) return;
      const session = getGroupSession(ctx.chat!.id, from.id);
      if (session.phase === "idle") {
        await ctx.reply("No group quiz running. Use /gquiz to start one.");
        return;
      }
      if (session.hostId !== from.id) {
        await ctx.reply("Only the quiz host can cancel the quiz.");
        return;
      }
      resetGroupSession(ctx.chat!.id, from.id);
      await ctx.reply("Group quiz cancelled.");
    } else {
      const session = getSession(ctx.chat!.id);
      if (session.phase === "idle") {
        await ctx.reply("Nothing to cancel. Send /quiz to start.");
        return;
      }
      resetSession(ctx.chat!.id);
      await ctx.reply("Quiz cancelled. Send /quiz to start a new one.");
    }
  });

  // ── /quiz (solo) ─────────────────────────────────────────────────────────────

  bot.command("quiz", async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply(
        "For group competitions use /gquiz in this chat!",
      );
      return;
    }
    const session = resetSession(ctx.chat!.id);
    session.phase = "awaiting_topic";
    await ctx.reply(
      "What topic do you want to be quizzed on?\n\n" +
        "Examples: <i>World War II</i>, <i>Greek mythology</i>, <i>NBA history</i>, <i>Quantum physics</i>",
      { parse_mode: "HTML" },
    );
  });

  // ── /gquiz (group) ───────────────────────────────────────────────────────────

  bot.command("gquiz", async (ctx) => {
    const from = (ctx as any).from;
    if (!from) return;

    if (!isGroupChat(ctx)) {
      await ctx.reply(
        "Group quizzes only work in group/supergroup chats.\n" +
          "Use /quiz here for a solo game!",
      );
      return;
    }

    const chatId = ctx.chat!.id;
    const existing = getGroupSession(chatId, from.id);
    if (existing.phase !== "idle" && existing.phase !== "finished") {
      await ctx.reply(
        "A quiz is already running! Use /cancel to stop it first.",
      );
      return;
    }

    const session = resetGroupSession(chatId, from.id);
    session.phase = "awaiting_topic";

    await ctx.reply(
      `🎮 <b>Group Quiz started by ${escapeHtml(getSenderName(ctx))}!</b>\n\n` +
        "What topic should the quiz be on?\n" +
        "<i>Anyone in the chat can type the topic.</i>",
      { parse_mode: "HTML" },
    );
  });

  // ── /skip (solo leaderboard skip) ───────────────────────────────────────────

  bot.command("skip", async (ctx) => {
    if (isGroupChat(ctx)) return;
    const session = getSession(ctx.chat!.id);
    if (session.phase === "awaiting_nickname") {
      session.phase = "idle";
      await ctx.reply("Skipped. Send /quiz to play again.");
    }
  });

  // ── /leaderboard ─────────────────────────────────────────────────────────────

  bot.command("leaderboard", async (ctx) => {
    const entries = getGlobalLeaderboard(10);
    const text = renderLeaderboard(entries, "🌍 Global Leaderboard — All Topics");
    await ctx.reply(text, { parse_mode: "HTML" });
  });

  // ── /topleaderboard ───────────────────────────────────────────────────────────

  bot.command("topleaderboard", async (ctx) => {
    // Extract optional inline argument, e.g. "/topleaderboard science"
    const args = (ctx.message as any)?.text?.split(/\s+/).slice(1).join(" ").trim();
    if (args && args.length > 0) {
      const entries = getCategoryLeaderboard(args, 10);
      await ctx.reply(
        renderLeaderboard(entries, `📊 Leaderboard — "${args}"`),
        { parse_mode: "HTML" },
      );
    } else {
      // Ask them to type a category
      const session = getSession(ctx.chat!.id);
      session.phase = "awaiting_leaderboard_category";
      await ctx.reply(
        "Which topic/category leaderboard do you want to see?\n\n" +
          "Examples: <i>science</i>, <i>history</i>, <i>sports</i>",
        { parse_mode: "HTML" },
      );
    }
  });

  // ── /stats ───────────────────────────────────────────────────────────────────

  bot.command("stats", async (ctx) => {
    const stats = lifetimeStats.get(ctx.chat!.id);
    if (!stats || stats.total === 0) {
      await ctx.reply("No stats yet — play a quiz first using /quiz!");
      return;
    }
    const score = Math.round((stats.correct / stats.total) * 100);
    await ctx.reply(
      `<b>Your Lifetime Stats</b>\n\n` +
        `<b>Total questions:</b> ${stats.total}\n` +
        `<b>Correct:</b> ${stats.correct}\n` +
        `<b>Score:</b> ${score}%`,
      { parse_mode: "HTML" },
    );
  });

  // ── /about ───────────────────────────────────────────────────────────────────

  bot.command("about", async (ctx) => {
    await ctx.reply(
      "🤖 <b>Trivia Bot</b>\n" +
        "AI-generated trivia on any topic.\n\n" +
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

  // ── Text handler ─────────────────────────────────────────────────────────────

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const chatId = ctx.chat!.id;
    const from = (ctx as any).from;

    // ── Group chat text flow ──────────────────────────────────────────────────
    if (isGroupChat(ctx)) {
      if (!from) return;
      const session = getGroupSession(chatId, from.id);

      if (session.phase === "awaiting_topic") {
        if (text.length < 2 || text.length > 120) {
          await ctx.reply("Please enter a topic between 2 and 120 characters.");
          return;
        }
        session.topic = text;
        session.phase = "awaiting_count";
        await ctx.reply(
          `Topic: <b>${escapeHtml(text)}</b>\n\nHow many questions?`,
          { parse_mode: "HTML", ...buildCountKeyboard("gcount") },
        );
      } else if (session.phase === "in_progress") {
        // Silently ignore free text during quiz
      }
      return;
    }

    // ── Solo chat text flow ───────────────────────────────────────────────────
    const session = getSession(chatId);

    // Leaderboard category query
    if (session.phase === "awaiting_leaderboard_category") {
      if (text.length < 1 || text.length > 60) {
        await ctx.reply("Please enter a category name (1–60 chars).");
        return;
      }
      session.phase = "idle";
      const entries = getCategoryLeaderboard(text, 10);
      await ctx.reply(
        renderLeaderboard(entries, `📊 Leaderboard — "${text}"`),
        { parse_mode: "HTML" },
      );
      return;
    }

    // Nickname after solo quiz
    if (session.phase === "awaiting_nickname") {
      if (text.length < 1 || text.length > 24) {
        await ctx.reply(
          "Nickname must be between 1 and 24 characters. Try again, or press Skip.",
        );
        return;
      }
      session.nickname = text;
      const total = session.results.length;
      const correct = session.results.filter((r) => r.isCorrect).length;
      const correctResults = session.results.filter((r) => r.isCorrect);
      const avgSpeedMs =
        correctResults.length > 0
          ? correctResults.reduce((s, r) => s + r.timeMs, 0) /
            correctResults.length
          : 0;

      recordResult({
        userId: chatId,
        nickname: text,
        topic: session.topic ?? "Trivia",
        category: (session.topic ?? "trivia").toLowerCase().trim(),
        correct,
        total,
        avgSpeedMs,
        recordedAt: Date.now(),
      });

      session.phase = "idle";
      await ctx.reply(
        `✅ Saved as <b>${escapeHtml(text)}</b>!\n\n` +
          "Check /leaderboard or /topleaderboard to see where you stand.",
        { parse_mode: "HTML" },
      );
      return;
    }

    if (session.phase === "awaiting_topic") {
      if (text.length < 2 || text.length > 120) {
        await ctx.reply("Please enter a topic between 2 and 120 characters.");
        return;
      }
      session.topic = text;
      session.phase = "awaiting_count";
      await ctx.reply(
        `Topic: <b>${escapeHtml(text)}</b>\n\nHow many questions?`,
        { parse_mode: "HTML", ...buildCountKeyboard("count") },
      );
      return;
    }

    if (session.phase === "in_progress") {
      await ctx.reply(
        "Tap one of the answer buttons, or /cancel to stop.",
      );
      return;
    }

    if (session.phase === "idle" || session.phase === "finished") {
      await ctx.reply("Send /quiz to start a new trivia round.");
    }
  });

  // ── Solo count selection ──────────────────────────────────────────────────

  bot.action(/^count:(\d+)$/, async (ctx) => {
    const count = Number(ctx.match[1]);
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
        `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${count}</b>\n\nGenerating…`,
        { parse_mode: "HTML" },
      );
    } catch { /* ignore */ }

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
      await sendNextSoloQuestion(ctx, session);
    } catch (err) {
      console.error("Failed to generate questions:", err);
      resetSession(chatId);
      await ctx.reply(
        "Sorry, couldn't generate questions. Please try /quiz again.",
      );
    }
  });

  // ── Group count selection ──────────────────────────────────────────────────

  bot.action(/^gcount:(\d+)$/, async (ctx) => {
    const count = Number(ctx.match[1]);
    const chatId = ctx.chat?.id;
    const from = (ctx as any).from;
    if (chatId === undefined || !from) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getGroupSession(chatId, from.id);

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
        `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${count}</b>\n\nGenerating…`,
        { parse_mode: "HTML" },
      );
    } catch { /* ignore */ }

    try {
      const questions = await generateTriviaQuestions(session.topic, count);
      session.questions = questions;
      session.currentIndex = 0;
      session.results = [];
      session.phase = "in_progress";
      session.quizStartedAt = Date.now();
      await ctx.reply(
        `🎮 <b>Quiz starting!</b> ${questions.length} questions on <b>${escapeHtml(session.topic)}</b>.\n` +
          "First correct tap wins each question! Timer starts now.",
        { parse_mode: "HTML" },
      );
      await sendNextGroupQuestion(ctx, session);
    } catch (err) {
      console.error("Failed to generate group questions:", err);
      resetGroupSession(chatId, from.id);
      await ctx.reply(
        "Sorry, couldn't generate questions. Please try /gquiz again.",
      );
    }
  });

  // ── Solo answer ────────────────────────────────────────────────────────────

  bot.action(/^ans:(\d+):(\d+)$/, async (ctx) => {
    const qIndex = Number(ctx.match[1]);
    const choice = Number(ctx.match[2]);
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

    const correctLetter = LETTERS[question.correctIndex]!;
    const yourLetter = LETTERS[choice]!;
    const verdict = isCorrect
      ? `✅ Correct! (${formatDuration(elapsed)})`
      : `❌ Wrong. You picked <b>${yourLetter}</b>, correct was <b>${correctLetter}</b>. (${formatDuration(elapsed)})`;

    const updated =
      buildQuestionText(session.questions, qIndex) +
      `\n\n${verdict}` +
      (question.explanation
        ? `\n<i>${escapeHtml(question.explanation)}</i>`
        : "");

    try {
      await ctx.editMessageText(updated, { parse_mode: "HTML" });
    } catch { /* ignore */ }

    session.currentIndex += 1;
    if (session.currentIndex >= session.questions.length) {
      await finishSoloQuiz(ctx, session);
    } else {
      await sendNextSoloQuestion(ctx, session);
    }
  });

  // ── Group answer ───────────────────────────────────────────────────────────

  bot.action(/^gans:(\d+):(\d+)$/, async (ctx) => {
    const qIndex = Number(ctx.match[1]);
    const choice = Number(ctx.match[2]);
    const chatId = ctx.chat?.id;
    const from = (ctx as any).from;
    if (chatId === undefined || !from) {
      await ctx.answerCbQuery();
      return;
    }

    const session = getGroupSession(chatId, from.id);

    if (session.phase !== "in_progress") {
      await ctx.answerCbQuery("No quiz is running right now.");
      return;
    }
    if (qIndex !== session.currentIndex) {
      await ctx.answerCbQuery("That question is already closed.");
      return;
    }

    const question = session.questions[qIndex];
    if (!question) {
      await ctx.answerCbQuery();
      return;
    }

    const elapsed = session.questionStartedAt
      ? Date.now() - session.questionStartedAt
      : 0;

    const displayName = getSenderName(ctx);
    const outcome = registerGroupAnswer(
      session,
      from.id,
      displayName,
      choice,
      elapsed,
    );

    if (outcome === "already_answered") {
      await ctx.answerCbQuery("You already answered this question!");
      return;
    }

    if (outcome === "accepted_correct") {
      const result = session.results[qIndex]!;
      const isFirstCorrect = result.winnerId === from.id;

      if (isFirstCorrect) {
        await ctx.answerCbQuery(`✅ Correct! First! (${formatDuration(elapsed)})`);
      } else {
        await ctx.answerCbQuery(`✅ Correct! (but someone was faster)`);
      }
    } else {
      await ctx.answerCbQuery("❌ Wrong answer.");
    }

    // After EVERY answer, check if we should close the question.
    // Strategy: close immediately on the first correct answer, then move on.
    const result = session.results[qIndex]!;
    if (result.winnerId !== null) {
      // First correct answer received — close the question
      const correctLetter = LETTERS[question.correctIndex]!;
      const winnerLine =
        `✅ <b>${escapeHtml(result.winnerName ?? "")}</b> got it first` +
        ` in ${formatDuration(result.winnerElapsedMs ?? 0)}!` +
        ` Answer: <b>${correctLetter}</b>`;

      const updatedText =
        buildQuestionText(session.questions, qIndex) +
        `\n\n${winnerLine}` +
        (question.explanation
          ? `\n<i>${escapeHtml(question.explanation)}</i>`
          : "");

      try {
        await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
      } catch { /* ignore */ }

      // Brief pause, then next question
      await new Promise((r) => setTimeout(r, 1500));

      session.currentIndex += 1;
      if (session.currentIndex >= session.questions.length) {
        await finishGroupQuiz(ctx, session);
      } else {
        await sendNextGroupQuestion(ctx, session);
      }
    }
    // If no correct answer yet, do nothing — other players can still answer
  });

  // ── Skip nickname button ───────────────────────────────────────────────────

  bot.action("skip_nickname", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getSession(chatId);
    if (session.phase === "awaiting_nickname") {
      session.phase = "idle";
      await ctx.answerCbQuery("Skipped");
      try {
        await ctx.editMessageText(
          "Skipped leaderboard entry. Send /quiz to play again!",
        );
      } catch {
        await ctx.reply("Skipped. Send /quiz to play again!");
      }
    } else {
      await ctx.answerCbQuery();
    }
  });

  // ── Error handler ──────────────────────────────────────────────────────────

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