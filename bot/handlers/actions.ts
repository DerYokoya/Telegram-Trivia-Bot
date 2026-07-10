import { Context } from "telegraf";
import { getSession } from "./../quiz";
import { getGroupSession, resetGroupSession, registerGroupAnswer } from "./../groupquiz";
import { fetchValidatedTriviaQuestions, getTopicSource } from "./../triviaService";
import { recordFirstQ1Correct, renderNewAchievements, recordSoloQuizComplete, recordGroupQuizParticipation } from "../achievements";
import { sendNextSoloQuestion, finishSoloQuiz } from "./quiz/solo";
import { sendNextGroupQuestion, finishGroupQuiz } from "./quiz/group";
import { buildQuestionText } from "../messages";
import { buildDifficultyKeyboard, buildCountKeyboard, buildAnswerKeyboard } from "../keyboards";
import { escapeHtml, formatDuration, getSenderName, checkAndAnnounceLeaderboardAchievements } from "../utils";
import { LETTERS } from "../../constants";

export function registerActions(bot: any) {
  // Solo count selection
  bot.action(/^count:(\d+)$/, async (ctx: any) => {
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
    if (![5, 10, 15, 20].includes(count)) {
      await ctx.answerCbQuery("Invalid count.");
      return;
    }

    await ctx.answerCbQuery(`${count} questions selected`);
    session.desiredCount = count;
    session.phase = "awaiting_difficulty";

    try {
      await ctx.editMessageText(
        `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${count}</b>\n\nChoose difficulty:`,
        { parse_mode: "HTML", ...buildDifficultyKeyboard("diff") },
      );
    } catch {
      await ctx.reply(`Questions: <b>${count}</b>\n\nChoose difficulty:`, {
        parse_mode: "HTML",
        ...buildDifficultyKeyboard("diff"),
      });
    }
  });

  // Solo difficulty selection
  bot.action(/^diff:(easy|medium|hard|random)$/, async (ctx: any) => {
    const difficulty = ctx.match[1] as "easy" | "medium" | "hard" | "random";
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getSession(chatId);

    if (
      session.phase !== "awaiting_difficulty" ||
      !session.topic ||
      !session.desiredCount
    ) {
      await ctx.answerCbQuery("That choice is no longer active.");
      return;
    }

    const diffIcons: Record<string, string> = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
      random: "🎲",
    };
    const diffLabel =
      difficulty === "random"
        ? "🎲 Random"
        : `${diffIcons[difficulty]} ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    await ctx.answerCbQuery(`Difficulty: ${diffLabel}`);
    session.difficulty = difficulty;
    session.phase = "loading";

    const source = getTopicSource(session.topic);
    const loadingMsg =
      source === "ai"
        ? `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${session.desiredCount}</b>\nDifficulty: <b>${diffLabel}</b>\n\n🤖 Generating with AI — this may take a few seconds…`
        : `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${session.desiredCount}</b>\nDifficulty: <b>${diffLabel}</b>\n\n⏳ Loading…`;

    try {
      await ctx.editMessageText(loadingMsg, { parse_mode: "HTML" });
    } catch {
      /* ignore */
    }

    try {
      const questions = await fetchValidatedTriviaQuestions(
        session.topic,
        session.desiredCount,
        session.difficulty,
      );
      session.questions = questions;
      session.questionDifficulties = questions
        .map((q) => q.difficulty)
        .filter((d): d is "easy" | "medium" | "hard" => d !== undefined);
      session.currentIndex = 0;
      session.results = [];
      session.phase = "in_progress";
      session.quizStartedAt = Date.now();
      await sendNextSoloQuestion(ctx, session);
    } catch (err) {
      console.error("Failed to generate solo questions:", err);
      const { resetSession } = require("../quiz");
      resetSession(chatId);
      await ctx.reply(
        "Sorry, couldn't generate questions. Please try /quiz again.",
      );
    }
  });

  // Group count selection
  bot.action(/^gcount:(\d+)$/, async (ctx: any) => {
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
    if (![5, 10, 15, 20].includes(count)) {
      await ctx.answerCbQuery("Invalid count.");
      return;
    }

    await ctx.answerCbQuery(`${count} questions selected`);
    session.desiredCount = count;
    session.phase = "awaiting_difficulty";

    try {
      await ctx.editMessageText(
        `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${count}</b>\n\nChoose difficulty:`,
        { parse_mode: "HTML", ...buildDifficultyKeyboard("gdiff") },
      );
    } catch {
      await ctx.reply(`Questions: <b>${count}</b>\n\nChoose difficulty:`, {
        parse_mode: "HTML",
        ...buildDifficultyKeyboard("gdiff"),
      });
    }
  });

  // Group difficulty selection
  bot.action(/^gdiff:(easy|medium|hard|random)$/, async (ctx: any) => {
    const difficulty = ctx.match[1] as "easy" | "medium" | "hard" | "random";
    const chatId = ctx.chat?.id;
    const from = (ctx as any).from;
    if (chatId === undefined || !from) {
      await ctx.answerCbQuery();
      return;
    }
    const session = getGroupSession(chatId, from.id);

    if (
      session.phase !== "awaiting_difficulty" ||
      !session.topic ||
      !session.desiredCount
    ) {
      await ctx.answerCbQuery("That choice is no longer active.");
      return;
    }

    const diffIcons: Record<string, string> = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
      random: "🎲",
    };
    const diffLabel =
      difficulty === "random"
        ? "🎲 Random"
        : `${diffIcons[difficulty]} ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    await ctx.answerCbQuery(`Difficulty: ${diffLabel}`);
    session.difficulty = difficulty;
    session.phase = "loading";

    const source = getTopicSource(session.topic);
    const loadingMsg =
      source === "ai"
        ? `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${session.desiredCount}</b>\nDifficulty: <b>${diffLabel}</b>\n\n🤖 Generating with AI — this may take a few seconds…`
        : `Topic: <b>${escapeHtml(session.topic)}</b>\nQuestions: <b>${session.desiredCount}</b>\nDifficulty: <b>${diffLabel}</b>\n\n⏳ Loading…`;

    try {
      await ctx.editMessageText(loadingMsg, { parse_mode: "HTML" });
    } catch {
      /* ignore */
    }

    try {
      const questions = await fetchValidatedTriviaQuestions(
        session.topic,
        session.desiredCount,
        session.difficulty,
      );
      session.questions = questions;
      session.questionDifficulties = questions
        .map((q) => q.difficulty)
        .filter((d): d is "easy" | "medium" | "hard" => d !== undefined);
      session.currentIndex = 0;
      session.results = [];
      session.phase = "in_progress";
      session.quizStartedAt = Date.now();
      await ctx.reply(
        `🎮 <b>Quiz starting!</b> ${questions.length} questions on <b>${escapeHtml(session.topic)}</b> · <b>${diffLabel}</b>\n` +
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

  // Solo answer
  bot.action(/^ans:(\d+):(\d+)$/, async (ctx: any) => {
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

    const correctLetter = LETTERS[question.correctIndex];
    const yourLetter = LETTERS[choice];
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
    } catch {
      /* ignore */
    }

    session.currentIndex += 1;
    if (session.currentIndex >= session.questions.length) {
      await finishSoloQuiz(ctx, session);
    } else {
      await sendNextSoloQuestion(ctx, session);
    }
  });

  // Group answer
  bot.action(/^gans:(\d+):(\d+)$/, async (ctx: any) => {
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
    const { status, cooldownRemainingMs } = registerGroupAnswer(
      session,
      from.id,
      displayName,
      choice,
      elapsed,
    );

    if (status === "on_cooldown") {
      const secondsLeft = Math.ceil(cooldownRemainingMs! / 1000);
      await ctx.answerCbQuery(
        `⏳ You must wait ${secondsLeft}s to try again!`,
        { show_alert: true },
      );
      return;
    }

    if (status === "question_closed") {
      await ctx.answerCbQuery("⌛ This question is already closed.");
      return;
    }

    if (status === "accepted_correct") {
      const result = session.results[qIndex];
      const isFirstCorrect = result?.winnerId === from.id;

      // Achievement: first correct on Q1
      if (isFirstCorrect && qIndex === 0) {
        const newAchs = await recordFirstQ1Correct(from.id);
        if (newAchs.length > 0) {
          const msg = renderNewAchievements(newAchs);
          if (msg)
            ctx
              .reply(`<b>${escapeHtml(displayName)}</b>${msg}`, {
                parse_mode: "HTML",
              })
              .catch(() => undefined);
        }
      }

      if (isFirstCorrect) {
        await ctx.answerCbQuery(
          `✅ Correct! First! (${formatDuration(elapsed)})`,
        );
      } else {
        await ctx.answerCbQuery("✅ Correct! (but someone was faster)");
      }
    } else {
      await ctx.answerCbQuery("❌ Wrong answer.");
    }

    // Close question on first correct answer
    const result = session.results[qIndex];
    if (result?.winnerId !== null) {
      const correctLetter = LETTERS[question.correctIndex];
      const winnerLine =
        `✅ <b>${escapeHtml(result?.winnerName ?? "")}</b> got it first` +
        ` in ${formatDuration(result?.winnerElapsedMs ?? 0)}!` +
        ` Answer: <b>${correctLetter}</b>`;

      const updatedText =
        buildQuestionText(session.questions, qIndex) +
        `\n\n${winnerLine}` +
        (question.explanation
          ? `\n<i>${escapeHtml(question.explanation)}</i>`
          : "");

      try {
        await ctx.editMessageText(updatedText, { parse_mode: "HTML" });
      } catch {
        /* ignore */
      }

      await new Promise((r) => setTimeout(r, 1500));

      session.currentIndex += 1;
      if (session.currentIndex >= session.questions.length) {
        await finishGroupQuiz(ctx, session);
      } else {
        await sendNextGroupQuestion(ctx, session);
      }
    }
  });

  // Skip nickname button
  bot.action("skip_nickname", async (ctx: any) => {
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
}