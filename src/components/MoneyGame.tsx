import React, { useState, useEffect } from "react";
import { Gamepad2, Target, TrendingUp, Award, RotateCcw, Send } from "@phosphor-icons/react";
import { api } from "../lib/api";
import type { Database } from "../supabaseTypes";

type GameSession = Database["public"]["Tables"]["game_sessions"]["Row"];
type GameScore = Database["public"]["Tables"]["game_scores"]["Row"];

interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  maxScore: number;
  questions: ScenarioQuestion[];
}

interface ScenarioQuestion {
  id: string;
  question: string;
  type: "choice" | "input";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: "cash_flow_101",
    name: "Cash Flow Management",
    description: "Learn how to manage your business cash flow effectively",
    difficulty: "beginner",
    maxScore: 100,
    questions: [
      {
        id: "q1",
        question: "Your customer buys goods worth $5000 on credit, payable in 30 days. What happens to your cash flow today?",
        type: "choice",
        options: ["Cash increases by $5000", "Cash decreases by $5000", "No immediate cash change"],
        correctAnswer: "No immediate cash change",
        explanation: "Cash flow is about actual money movement. A credit sale is revenue but not immediate cash.",
        points: 10,
      },
      {
        id: "q2",
        question: "You need $10,000 cash for inventory in 15 days. You have $3,000 now. What's the best approach?",
        type: "choice",
        options: [
          "Wait for customer payments",
          "Take a loan immediately",
          "Start collecting outstanding receivables",
          "Reduce inventory order",
        ],
        correctAnswer: "Start collecting outstanding receivables",
        explanation: "Accelerating collection of existing receivables is faster and cheaper than borrowing.",
        points: 15,
      },
    ],
  },
  {
    id: "pricing_strategy",
    name: "Pricing Strategy",
    description: "Master pricing decisions for maximum profitability",
    difficulty: "intermediate",
    maxScore: 100,
    questions: [
      {
        id: "q3",
        question: "Your product costs $10 to make. Competitors sell similar products at $20. What price should you set?",
        type: "choice",
        options: ["$15 (undercut)", "$20 (match)", "$25 (premium)", "Depends on market position"],
        correctAnswer: "Depends on market position",
        explanation: "Pricing depends on your market position, brand value, and customer perception—not just costs.",
        points: 20,
      },
    ],
  },
  {
    id: "budgeting_basics",
    name: "Budgeting Basics",
    description: "Create and manage effective budgets",
    difficulty: "beginner",
    maxScore: 100,
    questions: [
      {
        id: "q4",
        question: "Your budget shows $10K revenue next month, but you typically collect 70% within 30 days. For cash planning, which number should you use?",
        type: "choice",
        options: ["$10,000", "$7,000", "$3,000"],
        correctAnswer: "$7,000",
        explanation: "Cash budgets must account for collection delays and payment terms, not just invoiced amounts.",
        points: 15,
      },
    ],
  },
];

interface MoneyGameProps {
  businessId: string;
  userId: string;
}

export function MoneyGame({ businessId, userId }: MoneyGameProps) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [gameState, setGameState] = useState<"menu" | "scenario" | "results">("menu");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSessions();
  }, [businessId, userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/game-sessions", {
        params: { businessId, userId },
      });
      setSessions(response.data.sessions || []);
      setScores(response.data.scores || []);
    } catch (err) {
      console.error("Failed to load game sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSessionScore(0);
    setGameState("scenario");

    // Create new session in backend
    api.post("/api/game-sessions", {
      business_id: businessId,
      user_id: userId,
      game_state: { scenario: scenario.id },
    }).catch(console.error);
  };

  const submitAnswer = async (answer: string) => {
    if (!selectedScenario) return;

    const currentQuestion = selectedScenario.questions[currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;
    const points = isCorrect ? currentQuestion.points : 0;

    setAnswers({
      ...answers,
      [currentQuestion.id]: answer,
    });

    setSessionScore(sessionScore + points);

    if (currentQuestionIndex < selectedScenario.questions.length - 1) {
      // Next question
      setTimeout(() => setCurrentQuestionIndex(currentQuestionIndex + 1), 1000);
    } else {
      // Session complete
      await saveSessionScore();
      setGameState("results");
    }
  };

  const saveSessionScore = async () => {
    if (!selectedScenario) return;

    try {
      await api.post("/api/game-scores", {
        business_id: businessId,
        user_id: userId,
        scenario_id: selectedScenario.id,
        scenario_name: selectedScenario.name,
        score: sessionScore,
        max_score: selectedScenario.maxScore,
        performance_metrics: {
          correctAnswers: Object.entries(answers).filter(
            ([qId, ans]) => ans === selectedScenario.questions.find((q) => q.id === qId)?.correctAnswer
          ).length,
          totalQuestions: selectedScenario.questions.length,
        },
      });

      await loadSessions();
    } catch (err) {
      console.error("Failed to save score:", err);
    }
  };

  if (gameState === "menu") {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Gamepad2 className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Money Game</h1>
          </div>
          <p className="text-lg opacity-90">Learn financial management through interactive scenarios and challenges</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-emerald-600">{scores.length}</div>
            <div className="text-sm text-slate-600">Scenarios Completed</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-600">
              {scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0}
            </div>
            <div className="text-sm text-slate-600">Average Score</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-amber-600">{Math.min(scores.length * 10, 100)}</div>
            <div className="text-sm text-slate-600">Total Points</div>
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5" /> Available Scenarios
          </h2>

          {SCENARIOS.map((scenario) => {
            const completed = scores.some((s) => s.scenario_id === scenario.id);
            const bestScore = scores.filter((s) => s.scenario_id === scenario.id).sort((a, b) => b.score - a.score)[0];

            return (
              <div key={scenario.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{scenario.name}</h3>
                    <p className="text-sm text-slate-600 mb-2">{scenario.description}</p>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          scenario.difficulty === "beginner"
                            ? "bg-green-100 text-green-700"
                            : scenario.difficulty === "intermediate"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
                      </span>
                      <span className="text-xs text-slate-500">{scenario.questions.length} questions</span>
                      {completed && (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Award className="w-4 h-4" />
                          <span className="text-xs font-semibold">Best: {bestScore?.score}/100</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startNewSession(scenario)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg"
                  >
                    {completed ? "Replay" : "Start"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameState === "scenario" && selectedScenario) {
    const currentQuestion = selectedScenario.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / selectedScenario.questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg p-6 border border-slate-200">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">{selectedScenario.name}</h2>
            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-600 h-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="text-sm text-slate-600 mt-2">
              Question {currentQuestionIndex + 1} of {selectedScenario.questions.length}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800">{currentQuestion.question}</h3>

            {currentQuestion.type === "choice" ? (
              <div className="space-y-2">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => submitAnswer(option)}
                    className="w-full text-left p-4 border-2 border-slate-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Your answer"
                  defaultValue={answers[currentQuestion.id] || ""}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      submitAnswer((e.target as HTMLInputElement).value);
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() =>
                    submitAnswer((event?.target as HTMLInputElement)?.value || answers[currentQuestion.id] || "")
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Submit
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Think carefully about each decision and how it affects your business finances.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === "results" && selectedScenario) {
    const percentage = (sessionScore / selectedScenario.maxScore) * 100;

    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-8 text-white text-center">
          <Award className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Scenario Complete!</h1>
          <div className="text-5xl font-bold mb-2">{sessionScore}</div>
          <div className="text-lg opacity-90">out of {selectedScenario.maxScore} points</div>
          <div className="text-sm mt-4 opacity-75">Performance: {percentage.toFixed(0)}%</div>
        </div>

        {/* Answer Review */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-4">
          <h2 className="text-xl font-bold">Review Your Answers</h2>
          {selectedScenario.questions.map((q, idx) => {
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer === q.correctAnswer;

            return (
              <div key={q.id} className={`p-4 rounded-lg border-2 ${isCorrect ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="font-semibold mb-2">
                  {idx + 1}. {q.question}
                </div>
                <div className="text-sm mb-2">
                  <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>
                    {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                </div>
                <div className="text-sm text-slate-700 bg-white p-2 rounded mb-2 italic">{q.explanation}</div>
                <div className="text-xs text-slate-600">Points: {isCorrect ? q.points : 0}/{q.points}</div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setGameState("menu");
              setSelectedScenario(null);
            }}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            Back to Menu
          </button>
          <button
            onClick={() => startNewSession(selectedScenario)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
