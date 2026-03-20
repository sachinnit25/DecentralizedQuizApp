"use client";

import { useState, useCallback, useEffect } from "react";
import {
  submitAnswer,
  getScore,
  getQuestion,
  getTotalQuestions,
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

// ── Method Signature ─────────────────────────────────────────

function MethodSignature({
  name,
  params,
  returns,
  color,
}: {
  name: string;
  params: string;
  returns?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
      <span style={{ color }} className="font-semibold">fn</span>
      <span className="text-white/70">{name}</span>
      <span className="text-white/20 text-xs">{params}</span>
      {returns && (
        <span className="ml-auto text-white/15 text-[10px]">{returns}</span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

type Tab = "answer" | "score";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("answer");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Quiz state
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answer, setAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Score state
  const [scoreAddress, setScoreAddress] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [userScore, setUserScore] = useState<number | null>(null);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Load quiz data on mount
  useEffect(() => {
    loadQuizData();
  }, []);

  // Load user's score when wallet connects
  useEffect(() => {
    if (walletAddress) {
      loadUserScore(walletAddress);
    }
  }, [walletAddress]);

  const loadQuizData = async () => {
    try {
      const total = await getTotalQuestions();
      setTotalQuestions(total);
      if (total > 0) {
        const q = await getQuestion(0);
        setCurrentQuestion(typeof q === "string" ? q : "");
      }
    } catch (err) {
      // Quiz might not be initialized yet
      console.error("Quiz not initialized:", err);
    }
  };

  const loadUserScore = async (address: string) => {
    try {
      const s = await getScore(address);
      setUserScore(s);
    } catch {
      setUserScore(0);
    }
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!answer.trim()) return setError("Enter an answer");
    if (totalQuestions === 0) return setError("Quiz not initialized");

    setError(null);
    setIsSubmitting(true);
    setTxStatus("Awaiting signature...");

    try {
      await submitAnswer(walletAddress, currentIndex, answer.trim());
      setTxStatus("Answer submitted on-chain!");

      // Update score
      const newScore = await getScore(walletAddress);
      setUserScore(newScore);

      // Move to next question if available
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(currentIndex + 1);
        const nextQ = await getQuestion(currentIndex + 1);
        setCurrentQuestion(typeof nextQ === "string" ? nextQ : "");
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
  }, [walletAddress, answer, currentIndex, totalQuestions]);

  const handleCheckScore = useCallback(async () => {
    if (!scoreAddress.trim()) return setError("Enter an address to check");
    setError(null);
    setIsLoadingScore(true);
    setScore(null);

    try {
      const s = await getScore(scoreAddress.trim());
      setScore(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch score");
    } finally {
      setIsLoadingScore(false);
    }
  }, [scoreAddress]);

  const handleCheckMyScore = useCallback(async () => {
    if (!walletAddress) return;
    setError(null);
    setIsLoadingScore(true);
    try {
      const s = await getScore(walletAddress);
      setScore(s);
      setScoreAddress(walletAddress);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch score");
    } finally {
      setIsLoadingScore(false);
    }
  }, [walletAddress]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "answer", label: "Answer", icon: <SendIcon />, color: "#7c6cf0" },
    { key: "score", label: "Check Score", icon: <TrophyIcon />, color: "#fbbf24" },
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
            {txStatus.includes("on-chain") || txStatus.includes("completed") ? <CheckIcon /> : <SpinnerIcon />}
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
            <div className="flex items-center gap-2">
              {walletAddress && (
                <Badge variant="success" className="text-[10px]">
                  Score: {userScore ?? 0}/{totalQuestions}
                </Badge>
              )}
              <Badge variant="info" className="text-[10px]">Soroban</Badge>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setScore(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
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
            {/* Answer Tab */}
            {activeTab === "answer" && (
              <div className="space-y-5">
                <MethodSignature
                  name="submit_answer"
                  params="(user: Address, index: u32, answer: String)"
                  color="#7c6cf0"
                />

                {totalQuestions === 0 ? (
                  <div className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/[0.03] px-4 py-6 text-center">
                    <p className="text-sm text-[#fbbf24]/70">Quiz not initialized yet.</p>
                    <p className="text-xs text-white/30 mt-1">The quiz creator needs to initialize it first.</p>
                  </div>
                ) : (
                  <>
                    {/* Progress */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Question</span>
                        <Badge variant="warning">{currentIndex + 1} / {totalQuestions}</Badge>
                      </div>
                      {walletAddress && userScore !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/25">Your Score:</span>
                          <span className="text-sm font-mono text-[#34d399]">{userScore}</span>
                        </div>
                      )}
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
                      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
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
                      <ShimmerButton onClick={handleSubmitAnswer} disabled={isSubmitting} shimmerColor="#7c6cf0" className="w-full">
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
                        className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-4 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        Connect wallet to submit answer
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Score Tab */}
            {activeTab === "score" && (
              <div className="space-y-5">
                <MethodSignature
                  name="get_score"
                  params="(addr: Address)"
                  returns="-> u32"
                  color="#fbbf24"
                />

                {walletAddress && (
                  <button
                    onClick={handleCheckMyScore}
                    disabled={isLoadingScore}
                    className="w-full rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.03] py-3 text-sm text-[#34d399]/70 hover:border-[#34d399]/25 hover:text-[#34d399]/90 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Check My Score ({truncate(walletAddress)})
                  </button>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.06]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#050510] px-3 text-[10px] text-white/20">OR</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">Address to Check</label>
                  <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#fbbf24]/30 focus-within:shadow-[0_0_20px_rgba(251,191,36,0.08)]">
                    <input
                      type="text"
                      value={scoreAddress}
                      onChange={(e) => setScoreAddress(e.target.value)}
                      placeholder="G... address"
                      className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
                    />
                  </div>
                </div>

                <ShimmerButton onClick={handleCheckScore} disabled={isLoadingScore} shimmerColor="#fbbf24" className="w-full">
                  {isLoadingScore ? <><SpinnerIcon /> Fetching...</> : <><TrophyIcon /> Check Score</>}
                </ShimmerButton>

                {score !== null && (
                  <div className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/[0.03] p-6 text-center animate-fade-in-up">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[#fbbf24]"><TrophyIcon /></span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Score</span>
                    </div>
                    <p className="text-4xl font-bold font-mono text-white/90">
                      {score} <span className="text-lg text-white/30">/ {totalQuestions}</span>
                    </p>
                    {totalQuestions > 0 && (
                      <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden max-w-[200px] mx-auto">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#34d399] transition-all duration-500"
                          style={{ width: `${(score / totalQuestions) * 100}%` }}
                        />
                      </div>
                    )}
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
