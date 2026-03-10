import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  type GeneratePlanRequest,
  type Plan,
  type BoredomType,
  type EnergyLevel,
  type BudgetLevel,
} from "@/lib/plan";

const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: useOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
});
const model = process.env.AI_MODEL ?? (useOpenRouter ? "openai/gpt-oss-120b:free" : "gpt-4.1-mini");

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 10), 180);
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY or OPENAI_API_KEY must be set on the server." },
      { status: 500 },
    );
  }

  // #region agent log
  fetch('http://127.0.0.1:7500/ingest/7f5e0c7b-91e7-446d-9e97-88f12f139384',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f70673'},body:JSON.stringify({sessionId:'f70673',runId:'pre-fix',hypothesisId:'H1',location:'plan/generate/route.ts:POST:start',message:'Plan generation request received',data:{useOpenRouter,hasOpenRouterKey:Boolean(process.env.OPENROUTER_API_KEY),hasOpenAIKey:Boolean(process.env.OPENAI_API_KEY),model,baseURL:useOpenRouter?'https://openrouter.ai/api/v1':'(default)'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  let body: Partial<GeneratePlanRequest> = {};
  try {
    body = (await req.json()) as Partial<GeneratePlanRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const assignment_text = sanitizeText(body.assignment_text);
  if (!assignment_text) {
    return NextResponse.json(
      { error: "assignment_text is required." },
      { status: 400 },
    );
  }

  const boredom_type = parseEnum<BoredomType>(
    body.boredom_type,
    ["tedious", "understimulated", "draining", "meaningless"],
    "tedious",
  );
  const time_available_minutes = parseNumber(body.time_available_minutes, 30);
  const energy_level = parseEnum<EnergyLevel>(
    body.energy_level,
    ["low", "medium", "high"],
    "medium",
  );
  const can_go_out = Boolean(body.can_go_out);
  const budget_level = parseEnum<BudgetLevel>(
    body.budget_level,
    ["free", "small", "flexible"],
    "free",
  );
  const notes = sanitizeText(body.notes);

  const userPayload: GeneratePlanRequest = {
    assignment_text,
    boredom_type,
    time_available_minutes,
    energy_level,
    can_go_out,
    budget_level,
    notes: notes || undefined,
  };

  const systemPrompt =
    "You are a behavioral coach helping a student who procrastinates on boring or aversive work. " +
    "Given details about their assignment, boredom type, and constraints, you must generate a realistic, " +
    "gentle plan to help them start. The plan always has: " +
    "1) a warm-up novelty (2–5 minutes), 2) a tiny start step (~2 minutes), 3) a focused work sprint " +
    "(15–30 minutes but never longer than their time_available_minutes), and 4) a reward rule that is only unlocked " +
    "after the sprint. Respect safety (no harmful ideas), respect can_go_out, budget_level, and energy_level. " +
    "Return ONLY strict JSON matching the schema with keys: warmup, tiny_start_step, sprint, reward. " +
    "Do not include any explanations or extra keys.";

  const userPrompt = [
    "Here is the input JSON for the student:",
    "",
    JSON.stringify(userPayload, null, 2),
    "",
    "Generate a plan as JSON with this exact TypeScript interface:",
    "",
    "interface Plan {",
    "  warmup: {",
    "    label: string;",
    "    minutes: number; // between 2 and 5",
    "    indoors_outdoors: \"indoors\" | \"outdoors\" | \"either\";",
    "    backup_options: string[]; // 1-3 short alternative ideas",
    "  };",
    "  tiny_start_step: {",
    "    steps: string[]; // 1-3 atomic 1-2 sentence steps that take about 2 minutes total",
    "  };",
    "  sprint: {",
    "    minutes: number; // 15-30, but not more than time_available_minutes - warmup.minutes - 3",
    "    focus_rule: string;",
    "    break_rule: string;",
    "  };",
    "  reward: {",
    "    label: string; // a concrete, realistic reward",
    "    duration_minutes: number; // 5-20",
    "    unlock_condition: string; // what must be true to 'earn' it",
    "  };",
    "}",
  ].join("\n");

  let content: string | null = null;

  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    content = completion.choices[0]?.message?.content ?? null;
  } catch (error) {
    // #region agent log
    const errAny = error as any;
    const status = errAny?.status ?? errAny?.response?.status;
    const code = errAny?.code ?? errAny?.error?.code ?? errAny?.response?.data?.error?.code;
    const type = errAny?.type ?? errAny?.error?.type ?? errAny?.response?.data?.error?.type;
    const message = errAny?.message ?? errAny?.response?.data?.error?.message ?? String(error);
    fetch('http://127.0.0.1:7500/ingest/7f5e0c7b-91e7-446d-9e97-88f12f139384',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f70673'},body:JSON.stringify({sessionId:'f70673',runId:'pre-fix',hypothesisId:'H2',location:'plan/generate/route.ts:POST:catch',message:'AI provider error (sanitized)',data:{useOpenRouter,model,status,code,type,message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error("Error calling AI:", error);
    const errTyped = error as { status?: number; code?: string; type?: string };
    const isQuota = errTyped?.status === 429 || errTyped?.code === "insufficient_quota" || errTyped?.type === "insufficient_quota";
    const isOpenRouterPrivacyPolicyIssue =
      useOpenRouter && (status === 404 || code === 404) && typeof message === "string" && message.toLowerCase().includes("data policy");
    const userMessage = isOpenRouterPrivacyPolicyIssue
      ? "OpenRouter blocked this model due to your privacy/data policy settings. Visit https://openrouter.ai/settings/privacy and relax your policy (disable ZDR-only / allow data collection), then try again."
      : isQuota
        ? "Rate limit or quota exceeded. If using OpenRouter free tier, check your daily limit at openrouter.ai. For OpenAI, add a payment method at platform.openai.com."
        : "Failed to generate plan from AI.";
    return NextResponse.json(
      { error: userMessage },
      { status: 500 },
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: "No content returned from AI." },
      { status: 500 },
    );
  }

  let plan: Plan;
  try {
    plan = JSON.parse(content) as Plan;
  } catch (error) {
    console.error("Failed to parse AI JSON:", error, "raw:", content);
    return NextResponse.json(
      { error: "AI returned invalid JSON." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    plan,
  });
}

