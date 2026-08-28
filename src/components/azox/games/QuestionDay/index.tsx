import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Timer, Trophy } from "lucide-react";
import { useAzox } from "@/components/azox/app-provider";
import { useGameTasks } from "@/hooks/useGameTasks";
import { formatPoints } from "@/lib/azox-data";
import { haptic } from "@/lib/telegram";

type Question = {
  id: number;
  question: string;
  options: string[];
  correct: number;
  difficulty: "easy" | "medium" | "hard";
};

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "Which blockchain introduced smart contracts to the mainstream?",
    options: ["Bitcoin", "Ethereum", "Litecoin", "Dogecoin", "Monero"],
    correct: 1,
    difficulty: "easy",
  },
  {
    id: 2,
    question: "What does the abbreviation NFT stand for?",
    options: [
      "New Finance Token",
      "Network File Transfer",
      "Non-Fungible Token",
      "Node Fee Tracker",
      "Native Fiat Trade",
    ],
    correct: 2,
    difficulty: "easy",
  },
  {
    id: 3,
    question:
      "A wallet seed phrase is usually made of how many words in the most common standard?",
    options: ["6 words", "8 words", "10 words", "12 words", "24 words only"],
    correct: 3,
    difficulty: "medium",
  },
  {
    id: 4,
    question:
      "Which consensus mechanism does Ethereum use after The Merge upgrade completed in 2022?",
    options: [
      "Proof of Work",
      "Proof of Stake",
      "Proof of Authority",
      "Proof of Burn",
      "Proof of Space",
    ],
    correct: 1,
    difficulty: "medium",
  },
  {
    id: 5,
    question: "In crypto slang, what does HODL usually describe?",
    options: [
      "Selling quickly on a pump",
      "Holding an asset long term",
      "Hedging with derivatives",
      "Hardware only deep ledger",
      "High order daily limit",
    ],
    correct: 1,
    difficulty: "hard",
  },
];

const SECONDS_PER_QUESTION = 60;
const POINTS_PER_CORRECT = 100;
const LETTERS = ["A", "B", "C", "D", "E"];

export default function QuestionDay() {
  const { points: accountPoints, addPoints } = useAzox();
  const { onQuestionComplete } = useGameTasks();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [done, setDone] = useState(false);
  const completedRef = useRef(false);

  const current = SAMPLE_QUESTIONS[index] ?? SAMPLE_QUESTIONS[0]!;

  const next = useCallback(() => {
    setPicked(null);
    setTimeLeft(SECONDS_PER_QUESTION);
    setIndex((i) => {
      if (i + 1 >= SAMPLE_QUESTIONS.length) {
        setDone(true);
        return i;
      }
      return i + 1;
    });
  }, []);

  useEffect(() => {
    if (done || picked !== null) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          setPicked(-1);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [done, picked]);

  useEffect(() => {
    if (picked === null || done) return;
    const t = setTimeout(next, 1400);
    return () => clearTimeout(t);
  }, [picked, done, next]);

  useEffect(() => {
    if (!done || completedRef.current) return;
    completedRef.current = true;
    const correctCount = Math.round(score / POINTS_PER_CORRECT);
    const allCorrect = correctCount === SAMPLE_QUESTIONS.length;
    onQuestionComplete(allCorrect);
  }, [done, score, onQuestionComplete]);

  const answer = (i: number) => {
    if (picked !== null || done) return;
    setPicked(i);
    haptic();
    if (i === current.correct) {
      setScore((s) => s + POINTS_PER_CORRECT);
      addPoints(POINTS_PER_CORRECT);
    }
  };

  const optionStyle = (i: number) => {
    if (picked === null)
      return { background: "#1a1a1a", borderColor: "#22c55e", color: "#fff" };
    if (i === current.correct)
      return { background: "#22c55e", borderColor: "#22c55e", color: "#0d0d0d" };
    if (i === picked)
      return { background: "#ef4444", borderColor: "#ef4444", color: "#fff" };
    return { background: "#141414", borderColor: "#243024", color: "#9ca3af" };
  };

  return (
    <div
      className="flex min-h-[80dvh] flex-col gap-4"
      style={{ background: "#000" }}
    >
      <header className="flex items-center gap-3">
        <Link
          to="/gaming"
          aria-label="Back to gaming hub"
          className="glass grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 text-lg font-black" style={{ color: "#22c55e" }}>
          AZOX Question Day
        </h1>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold tabular-nums">
          <Coins className="size-3.5" style={{ color: "#FFD700" }} aria-hidden="true" />
          {formatPoints(accountPoints)}
        </span>
      </header>

      {done ? (
        <div
          className="rounded-3xl border p-6 text-center"
          style={{ background: "#0d0d0d", borderColor: "#22c55e" }}
        >
          <Trophy className="mx-auto size-8" style={{ color: "#FFD700" }} aria-hidden="true" />
          <p className="mt-3 text-base font-black" style={{ color: "#22c55e" }}>
            Quiz complete!
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You scored{" "}
            <span className="font-bold" style={{ color: "#FFD700" }}>
              {score}
            </span>{" "}
            points
          </p>
          <Link
            to="/gaming"
            className="mt-5 block rounded-xl px-4 py-2.5 text-sm font-black text-black"
            style={{ background: "#22c55e" }}
          >
            EXIT
          </Link>
        </div>
      ) : (
        <div
          className="flex flex-col gap-4 rounded-3xl border p-4"
          style={{ background: "#0d0d0d", borderColor: "rgba(34,197,94,0.35)" }}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground">
              Question {index + 1}/{SAMPLE_QUESTIONS.length}
            </span>
            <span
              className="flex items-center gap-1.5 font-mono tabular-nums"
              style={{ color: timeLeft < 10 ? "#ef4444" : "#22c55e" }}
            >
              <Timer className="size-3.5" aria-hidden="true" />
              {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
              {String(timeLeft % 60).padStart(2, "0")}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((index + 1) / SAMPLE_QUESTIONS.length) * 100}%`,
                background: "#22c55e",
              }}
            />
          </div>

          <div
            className="flex min-h-[84px] items-center rounded-2xl p-4"
            style={{ background: "#141414" }}
          >
            <p className="text-[16px] font-semibold leading-relaxed text-white">
              {current.question}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {current.options.map((opt, i) => (
              <button
                key={opt}
                type="button"
                onClick={() => answer(i)}
                disabled={picked !== null}
                className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors"
                style={optionStyle(i)}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-lg text-xs font-black"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    color: picked === null ? "#22c55e" : "inherit",
                  }}
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Score:{" "}
            <span className="font-bold" style={{ color: "#FFD700" }}>
              {score}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
