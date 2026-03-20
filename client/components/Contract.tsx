"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createQuiz,
  answerQuestion,
  getScore,
  getQuestion,
  getTotalQuestions,
  getAllQuizIds,
  getQuizQuestions,
  getLeaderboard,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────

type Tab = "browse" | "answer" | "create" | "leaderboard";

interface Quiz {
  id: number;
  questions: string[];
}

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Quiz list state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);

  // Answer state
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answer, setAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userScore, setUserScore] = useState<number>(0);

  // Create quiz state
  const [questions, setQuestions] = useState<string[]>([""]);
  const [answers, setAnswers] = useState<string[]>([""]);
  const [isCreating, setIsCreating] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<Array<{ user: string; score: number }>>([]);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Load quizzes on mount
  useEffect(() => {
    loadQuizzes();
  }, []);

  // Load user's score when wallet connects and quiz is selected
  useEffect(() => {
    if (walletAddress && selectedQuizId !== null) {
      loadUserScore();
    }
  }, [walletAddress, selectedQuizId]);

  const loadQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const ids = await getAllQuizIds();
      const loadedQuizzes: Quiz[] = [];
      for (const id of ids) {
        const qs = await getQuizQuestions(id);
        loadedQuizzes.push({ id, questions: qs });
      }
      setQuizzes(loadedQuizzes);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  const loadQuizData = async (quizId: number) => {
    try {
      const total = await getTotalQuestions(quizId);
      setTotalQuestions(total);
      setCurrentIndex(0);
      if (total > 0) {
        const q = await getQuestion(quizId, 0);
        setCurrentQuestion(q || "");
      }
    } catch (err) {
      console.error("Failed to load quiz:", err);
    }
  };

  const loadUserScore = async () => {
    if (!walletAddress || selectedQuizId === null) return;
    try {
      const score = await getScore(walletAddress, selectedQuizId);
      setUserScore(score);
    } catch {
      setUserScore(0);
    }
  };

  const handleSelectQuiz = async (quizId: number) => {
    setSelectedQuizId(quizId);
    await loadQuizData(quizId);
    setActiveTab("answer");
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!answer.trim()) return setError("Enter an answer");
    if (selectedQuizId === null) return setError("Select a quiz first");

    setError(null);
    setIsSubmitting(true);
    setTxStatus("Awaiting signature...");

    try {
      await answerQuestion(walletAddress, selectedQuizId, currentIndex, answer.trim());
      setTxStatus("Answer submitted on-chain!");

      // Update score
      const newScore = await getScore(walletAddress, selectedQuizId);
      setUserScore(newScore);

      // Move to next question if available
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(currentIndex + 1);
        const nextQ = await getQuestion(selectedQuizId, currentIndex + 1);
        setCurrentQuestion(nextQ || "");
        setAnswer("");
      } else {
        setTxStatus("You've completed the quiz!");
      }

      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, answer, currentIndex, totalQuestions, selectedQuizId]);

  const handleCreateQuiz = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    
    const validQuestions = questions.filter(q => q.trim() !== "");
    const validAnswers = answers.filter(a => a.trim() !== "");
    
    if (validQuestions.length === 0) return setError("Add at least one question");
    if (validQuestions.length !== validAnswers.length) return setError("Questions and answers must match");

    setError(null);
    setIsCreating(true);
    setTxStatus("Creating quiz on-chain...");

    try {
      const quizId = await createQuiz(walletAddress, validQuestions, validAnswers);
      setTxStatus(`Quiz created! ID: ${quizId}`);
      await loadQuizzes();
      
      // Reset form
      setQuestions([""]);
      setAnswers([""]);
      
      setTimeout(() => {
        setTxStatus(null);
        setActiveTab("browse");
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create quiz");
      setTxStatus(null);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, questions, answers]);

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
    setAnswers([...answers, ""]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
    setAnswers(answers.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const handleShowLeaderboard = async (quizId: number) => {
    try {
      const entries = await getLeaderboard(quizId);
      setLeaderboard(entries);
      setSelectedQuizId(quizId);
      setActiveTab("leaderboard");
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "browse", label: "Browse", icon: <ListIcon />, color: "#7c6cf0" },
    { key: "answer", label: "Answer", icon: <SendIcon />, color: "#34d399" },
    { key: "create", label: "Create", icon: <PlusIcon />, color: "#f97316" },
    { key: "leaderboard", label: "Scores", icon: <TrophyIcon />, color: "#fbbf24" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") || txStatus.includes("created") || txStatus.includes("completed") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#fbbf24]/20 border border-white/[0.06]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7c6cf0]">
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Decentralized Quiz</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="info" className="text-[10px]">Soroban</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Browse Tab */}
            {activeTab === "browse" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white/70">Available Quizzes</h4>
                  <button onClick={loadQuizzes} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                    Refresh
                  </button>
                </div>
                
                {isLoadingQuizzes ? (
                  <div className="text-center py-8 text-white/30">
                    <SpinnerIcon />
                    <p className="mt-2 text-sm">Loading quizzes...</p>
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/[0.03] px-4 py-8 text-center">
                    <p className="text-sm text-[#fbbf24]/70">No quizzes yet!</p>
                    <p className="text-xs text-white/30 mt-1">Be the first to create one.</p>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="mt-4 text-xs text-[#7c6cf0]/70 hover:text-[#7c6cf0]"
                    >
                      Create a Quiz →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-[#7c6cf0]">Quiz #{quiz.id}</span>
                              <span className="text-xs text-white/30">{quiz.questions.length} questions</span>
                            </div>
                            <p className="text-sm text-white/60 mt-1 truncate max-w-[250px]">
                              {quiz.questions[0] || "No questions"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleShowLeaderboard(quiz.id)}
                              className="rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/[0.05] px-3 py-1.5 text-xs text-[#fbbf24]/70 hover:bg-[#fbbf24]/10 transition-colors"
                            >
                              <TrophyIcon />
                            </button>
                            <button
                              onClick={() => handleSelectQuiz(quiz.id)}
                              className="rounded-lg bg-[#34d399]/10 border border-[#34d399]/20 px-3 py-1.5 text-xs text-[#34d399]/70 hover:bg-[#34d399]/20 transition-colors"
                            >
                              Play
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Answer Tab */}
            {activeTab === "answer" && (
              <div className="space-y-5">
                {selectedQuizId === null ? (
                  <div className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/[0.03] px-4 py-8 text-center">
                    <p className="text-sm text-[#fbbf24]/70">Select a quiz first</p>
                    <button
                      onClick={() => setActiveTab("browse")}
                      className="mt-2 text-xs text-[#7c6cf0]/70 hover:text-[#7c6cf0]"
                    >
                      Browse Quizzes →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Quiz</span>
                        <Badge variant="info">#{selectedQuizId}</Badge>
                      </div>
                      {walletAddress && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/25">Your Score:</span>
                          <span className="text-sm font-mono text-[#34d399]">{userScore}/{totalQuestions}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Question</span>
                        <Badge variant="warning">{currentIndex + 1} / {totalQuestions}</Badge>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7c6cf0] to-[#fbbf24] transition-all duration-500"
                        style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                      />
                    </div>

                    {/* Question */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#7c6cf0]/10 text-[#7c6cf0] text-xs font-bold">
                          {currentIndex + 1}
                        </span>
                        <p className="text-sm text-white/80 leading-relaxed">{currentQuestion || "Loading..."}</p>
                      </div>
                    </div>

                    {/* Answer Input */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">Your Answer</label>
                      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#34d399]/30 focus-within:shadow-[0_0_20px_rgba(52,211,153,0.08)]">
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                          placeholder="Type your answer..."
                          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
                        />
                      </div>
                    </div>

                    {walletAddress ? (
                      <ShimmerButton onClick={handleSubmitAnswer} disabled={isSubmitting} shimmerColor="#34d399" className="w-full">
                        {isSubmitting ? (
                          <><SpinnerIcon /> Submitting...</>
                        ) : (
                          <><SendIcon /> Submit Answer</>
                        )}
                      </ShimmerButton>
                    ) : (
                      <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="w-full rounded-xl border border-dashed border-[#34d399]/20 bg-[#34d399]/[0.03] py-4 text-sm text-[#34d399]/60 hover:border-[#34d399]/30 hover:text-[#34d399]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        Connect wallet to submit answer
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Create Quiz Tab */}
            {activeTab === "create" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white/70">Create New Quiz</h4>
                  <Badge variant="warning">Permissionless</Badge>
                </div>

                <p className="text-xs text-white/30">
                  Anyone can create a quiz. Add your questions and correct answers.
                </p>

                <div className="space-y-4">
                  {questions.map((_, index) => (
                    <div key={index} className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#f97316]/70">Question {index + 1}</span>
                        {questions.length > 1 && (
                          <button
                            onClick={() => handleRemoveQuestion(index)}
                            className="text-xs text-white/30 hover:text-[#f87171]/70"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={questions[index]}
                        onChange={(e) => handleQuestionChange(index, e.target.value)}
                        placeholder="Enter question..."
                        className="w-full rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none border border-white/[0.04] focus:border-[#f97316]/30"
                      />
                      <input
                        type="text"
                        value={answers[index]}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        placeholder="Correct answer..."
                        className="w-full rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-[#34d399]/90 placeholder:text-white/20 outline-none border border-white/[0.04] focus:border-[#34d399]/30 font-mono"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddQuestion}
                  className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-3 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 transition-all"
                >
                  <PlusIcon /> Add Question
                </button>

                {walletAddress ? (
                  <ShimmerButton onClick={handleCreateQuiz} disabled={isCreating} shimmerColor="#f97316" className="w-full">
                    {isCreating ? (
                      <><SpinnerIcon /> Creating...</>
                    ) : (
                      <><PlusIcon /> Create Quiz</>
                    )}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#f97316]/20 bg-[#f97316]/[0.03] py-4 text-sm text-[#f97316]/60 hover:border-[#f97316]/30 hover:text-[#f97316]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to create quiz
                  </button>
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === "leaderboard" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white/70">Leaderboard</h4>
                  {selectedQuizId !== null && (
                    <Badge variant="info">Quiz #{selectedQuizId}</Badge>
                  )}
                </div>

                {selectedQuizId === null && quizzes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quizzes.map((quiz) => (
                      <button
                        key={quiz.id}
                        onClick={() => handleShowLeaderboard(quiz.id)}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-white/50 hover:text-white/70 hover:border-white/[0.12] transition-all"
                      >
                        Quiz #{quiz.id}
                      </button>
                    ))}
                  </div>
                )}

                {leaderboard.length === 0 ? (
                  <div className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/[0.03] px-4 py-8 text-center">
                    <p className="text-sm text-[#fbbf24]/70">No scores yet!</p>
                    <p className="text-xs text-white/30 mt-1">Be the first to answer questions.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                            index === 0 ? "bg-[#fbbf24]/20 text-[#fbbf24]" :
                            index === 1 ? "bg-white/10 text-white/60" :
                            index === 2 ? "bg-[#f97316]/10 text-[#f97316]" :
                            "bg-white/5 text-white/30"
                          )}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-mono text-white/70">
                            {truncate(entry.user)}
                          </span>
                          {walletAddress && entry.user === walletAddress && (
                            <Badge variant="success" className="text-[8px]">You</Badge>
                          )}
                        </div>
                        <span className="text-lg font-bold font-mono text-[#fbbf24]">
                          {entry.score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Decentralized Quiz &middot; Soroban</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/15">Permissionless</span>
              <span className="h-1 w-1 rounded-full bg-[#34d399]" />
              <span className="text-[10px] text-white/15">Trustless</span>
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
