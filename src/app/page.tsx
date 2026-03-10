"use client";

import { useState, useEffect } from "react";
import type {
  Plan,
  BoredomType,
  EnergyLevel,
  BudgetLevel,
  GeneratePlanRequest,
} from "@/lib/plan";

type Step = "idle" | "warmup" | "tiny" | "sprint" | "check" | "reward";

interface HistoryItem {
  id: number;
  createdAt: string;
  assignmentSnippet: string;
  boredomType: BoredomType;
  plan: Plan;
  rating?: "up" | "down";
}

export default function Home() {
  const [assignmentText, setAssignmentText] = useState("");
  const [boredomType, setBoredomType] = useState<BoredomType>("tedious");
  const [timeAvailable, setTimeAvailable] = useState(30);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("medium");
  const [canGoOut, setCanGoOut] = useState(false);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>("free");
  const [notes, setNotes] = useState("");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [rewardUnlocked, setRewardUnlocked] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nextHistoryId, setNextHistoryId] = useState(1);

  useEffect(() => {
    if (!isRunning || remainingSeconds === null) return;

    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return prev;
        const next = prev - 1;
        if (next <= 0) {
          window.clearInterval(id);
          setIsRunning(false);
          handleStepComplete();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, step]);

  function handleStepComplete() {
    if (!plan) return;
    if (step === "warmup") {
      setStep("tiny");
      setRemainingSeconds(null);
    } else if (step === "tiny") {
      setStep("sprint");
      const sprintMinutes = Math.max(10, Math.min(plan.sprint.minutes, timeAvailable));
      setRemainingSeconds(sprintMinutes * 60);
    } else if (step === "sprint") {
      setStep("check");
      setRemainingSeconds(null);
    }
  }

  function startWarmup() {
    if (!plan) return;
    setStep("warmup");
    const minutes = Math.min(Math.max(plan.warmup.minutes, 2), 5);
    setRemainingSeconds(minutes * 60);
    setIsRunning(true);
    setRewardUnlocked(false);
  }

  function startTinyStep() {
    setStep("tiny");
    setRemainingSeconds(2 * 60);
    setIsRunning(true);
  }

  function startExtraSprint() {
    setStep("sprint");
    setRemainingSeconds(5 * 60);
    setIsRunning(true);
  }

  function handleHonestYes() {
    setStep("reward");
    setRewardUnlocked(true);
  }

  function handleHonestNo() {
    startExtraSprint();
  }

  function secondsToLabel(total: number | null): string {
    if (total === null) return "-";
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentText.trim()) {
      setError("Please paste an assignment or task first.");
      return;
    }
    setError(null);
    setLoading(true);
    setPlan(null);
    setStep("idle");
    setRemainingSeconds(null);
    setIsRunning(false);
    setRewardUnlocked(false);

    const payload: GeneratePlanRequest = {
      assignment_text: assignmentText.trim(),
      boredom_type: boredomType,
      time_available_minutes: timeAvailable,
      energy_level: energyLevel,
      can_go_out: canGoOut,
      budget_level: budgetLevel,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to generate plan.");
      }

      const data = (await res.json()) as { plan: Plan };
      setPlan(data.plan);
      setStep("warmup");
      const minutes = Math.min(Math.max(data.plan.warmup.minutes, 2), 5);
      setRemainingSeconds(minutes * 60);
      setIsRunning(false);

      const snippet = assignmentText.trim().slice(0, 160);
      setHistory((prev) => [
        {
          id: nextHistoryId,
          createdAt: new Date().toISOString(),
          assignmentSnippet: snippet,
          boredomType,
          plan: data.plan,
        },
        ...prev,
      ].slice(0, 5));
      setNextHistoryId((id) => id + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleRate(id: number, rating: "up" | "down") {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rating } : item,
      ),
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Boredom-to-Action Launchpad
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Paste the assignment you are avoiding, choose how it feels, and get
            a tiny warm-up + start step + sprint + reward plan that makes
            starting less painful.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Input
            </h2>
            <form className="space-y-4" onSubmit={handleGeneratePlan}>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  What are you putting off?
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white focus:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:text-zinc-900"
                  placeholder="Paste the assignment or task in your own words..."
                  value={assignmentText}
                  onChange={(e) => setAssignmentText(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">What kind of boredom?</span>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    { id: "tedious", label: "Tedious (repetitive, dull)" },
                    { id: "understimulated", label: "Understimulated (too easy / boring)" },
                    { id: "draining", label: "Draining (emotionally heavy)" },
                    { id: "meaningless", label: "Meaningless (pointless busywork)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBoredomType(opt.id as BoredomType)}
                      className={`rounded-full border px-3 py-2 text-left transition ${
                        boredomType === opt.id
                          ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                          : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-sm font-medium">
                    Time available (minutes)
                    <span className="text-xs font-normal text-zinc-500">
                      {timeAvailable} min
                    </span>
                  </label>
                  <input
                    type="range"
                    min={15}
                    max={90}
                    step={5}
                    value={timeAvailable}
                    onChange={(e) => setTimeAvailable(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Energy level</label>
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    value={energyLevel}
                    onChange={(e) => setEnergyLevel(e.target.value as EnergyLevel)}
                  >
                    <option value="low">Low (fried, tired)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={canGoOut}
                    onChange={(e) => setCanGoOut(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700"
                  />
                  I can go outside for this session
                </label>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget</label>
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    value={budgetLevel}
                    onChange={(e) => setBudgetLevel(e.target.value as BudgetLevel)}
                  >
                    <option value="free">Free only</option>
                    <option value="small">Small cost okay</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Anything else the plan should know?
                </label>
                <textarea
                  className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition focus:border-zinc-400 focus:bg-white focus:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:text-zinc-900"
                  placeholder="Constraints, worries, where you are, what sounds rewarding, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {loading ? "Generating plan..." : "Generate plan"}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Plan & Sprint
              </h2>

              {plan ? (
                <div className="mt-3 space-y-4">
                  <ol className="space-y-3 text-sm">
                    <li
                      className={`rounded-xl border px-3 py-2 ${
                        step === "warmup"
                          ? "border-zinc-900 bg-zinc-900/5 dark:border-zinc-100"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase text-zinc-500">
                            Step 1 · Warm-up novelty
                          </div>
                          <div className="text-sm font-medium">
                            {plan.warmup.label}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            ~{plan.warmup.minutes} min ·{" "}
                            {plan.warmup.indoors_outdoors}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-zinc-500">
                            {step === "warmup" && remainingSeconds !== null
                              ? secondsToLabel(remainingSeconds)
                              : ""}
                          </span>
                          <button
                            type="button"
                            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                            onClick={() => {
                              if (step !== "warmup") {
                                startWarmup();
                              } else {
                                setIsRunning((r) => !r);
                              }
                            }}
                          >
                            {step === "warmup"
                              ? isRunning
                                ? "Pause"
                                : "Resume"
                              : "Start warm-up"}
                          </button>
                        </div>
                      </div>
                      {plan.warmup.backup_options.length > 0 && (
                        <div className="mt-2 text-xs text-zinc-500">
                          Backups: {plan.warmup.backup_options.join(" · ")}
                        </div>
                      )}
                    </li>

                    <li
                      className={`rounded-xl border px-3 py-2 ${
                        step === "tiny"
                          ? "border-zinc-900 bg-zinc-900/5 dark:border-zinc-100"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase text-zinc-500">
                            Step 2 · Tiny start step
                          </div>
                          <ul className="mt-1 list-disc pl-4 text-sm">
                            {plan.tiny_start_step.steps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                          <div className="mt-1 text-xs text-zinc-500">
                            ~2 minutes total
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-zinc-500">
                            {step === "tiny" && remainingSeconds !== null
                              ? secondsToLabel(remainingSeconds)
                              : ""}
                          </span>
                          <button
                            type="button"
                            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                            onClick={() => {
                              if (step !== "tiny") {
                                startTinyStep();
                              } else {
                                setIsRunning((r) => !r);
                              }
                            }}
                          >
                            {step === "tiny"
                              ? isRunning
                                ? "Pause"
                                : "Resume"
                              : "Start tiny step"}
                          </button>
                        </div>
                      </div>
                    </li>

                    <li
                      className={`rounded-xl border px-3 py-2 ${
                        step === "sprint"
                          ? "border-zinc-900 bg-zinc-900/5 dark:border-zinc-100"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase text-zinc-500">
                            Step 3 · Focused sprint
                          </div>
                          <div className="text-sm font-medium">
                            Sprint for about {plan.sprint.minutes} minutes on
                            this assignment.
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Focus rule: {plan.sprint.focus_rule}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            Break rule: {plan.sprint.break_rule}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-zinc-500">
                            {step === "sprint" && remainingSeconds !== null
                              ? secondsToLabel(remainingSeconds)
                              : ""}
                          </span>
                          <button
                            type="button"
                            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                            onClick={() => {
                              if (step !== "sprint") {
                                const sprintMinutes = Math.max(
                                  10,
                                  Math.min(plan.sprint.minutes, timeAvailable),
                                );
                                setStep("sprint");
                                setRemainingSeconds(sprintMinutes * 60);
                                setIsRunning(true);
                              } else {
                                setIsRunning((r) => !r);
                              }
                            }}
                          >
                            {step === "sprint"
                              ? isRunning
                                ? "Pause"
                                : "Resume"
                              : "Start sprint"}
                          </button>
                        </div>
                      </div>
                    </li>

                    <li className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <div className="text-xs font-semibold uppercase text-zinc-500">
                        Step 4 · Reward
                      </div>
                      {step === "check" && (
                        <div className="mt-2 space-y-2 text-sm">
                          <p>
                            Did you honestly complete the tiny start step and
                            the sprint?
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleHonestYes}
                              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-500"
                            >
                              Yes, unlock reward
                            </button>
                            <button
                              type="button"
                              onClick={handleHonestNo}
                              className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                            >
                              Not really, give me a 5 min top-up sprint
                            </button>
                          </div>
                        </div>
                      )}
                      {rewardUnlocked && (
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="font-medium">
                            Reward: {plan.reward.label}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Duration: ~{plan.reward.duration_minutes} min
                          </div>
                          <div className="text-xs text-zinc-500">
                            Unlock condition: {plan.reward.unlock_condition}
                          </div>
                        </div>
                      )}
                      {!rewardUnlocked && step !== "check" && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Finish the sprint honestly to unlock your reward.
                        </p>
                      )}
                    </li>
                  </ol>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Once you generate a plan, your warm-up, tiny start, sprint,
                  and reward will appear here.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Recent plans
              </h2>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Your last few sessions will show up here once you run a plan.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {item.boredomType}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-zinc-800 dark:text-zinc-100">
                            {item.assignmentSnippet}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleRate(item.id, "up")}
                            className={`h-6 w-6 rounded-full text-[10px] font-semibold ${
                              item.rating === "up"
                                ? "bg-emerald-600 text-emerald-50"
                                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            }`}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRate(item.id, "down")}
                            className={`h-6 w-6 rounded-full text-[10px] font-semibold ${
                              item.rating === "down"
                                ? "bg-red-500 text-red-50"
                                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            }`}
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

