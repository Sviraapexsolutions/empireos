/**
 * Browser-side AI Accountability Coach.
 * Replaces the old Express `/api/coach/*` endpoints so the app can run as a static site.
 * API keys are entered by the user in Settings and stored only on this device (localStorage).
 */
import type { AiProvider } from '../types/empire';

const KEY_STORAGE = {
  gemini: 'empireos_gemini_api_key',
  claude: 'empireos_claude_api_key',
} as const;

const MODEL_STORAGE = {
  gemini: 'empireos_gemini_model',
  claude: 'empireos_claude_model',
} as const;

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-flash-latest',
  claude: 'claude-sonnet-5-5',
};

function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

export function getCoachApiKey(provider: AiProvider): string {
  return safeGet(KEY_STORAGE[provider]).trim();
}

export function setCoachApiKey(provider: AiProvider, value: string): void {
  safeSet(KEY_STORAGE[provider], value.trim());
}

export function getCoachModel(provider: AiProvider): string {
  return safeGet(MODEL_STORAGE[provider]).trim() || DEFAULT_MODELS[provider];
}

export function setCoachModel(provider: AiProvider, value: string): void {
  const v = value.trim();
  safeSet(MODEL_STORAGE[provider], v && v !== DEFAULT_MODELS[provider] ? v : '');
}

export interface ProviderAvailability {
  gemini: { configured: boolean; model: string };
  claude: { configured: boolean; model: string };
}

export function getProviderAvailability(): ProviderAvailability {
  return {
    gemini: { configured: Boolean(getCoachApiKey('gemini')), model: getCoachModel('gemini') },
    claude: { configured: Boolean(getCoachApiKey('claude')), model: getCoachModel('claude') },
  };
}

export type CoachTrigger = 'overdue' | 'rescheduled' | 'missed' | 'manual';

export interface RealityCheckInput {
  taskTitle: string;
  businessName: string;
  projectName?: string;
  completionPercent: number;
  triggerReason: CoachTrigger;
  provider: AiProvider;
}

export interface RealityCheckResult {
  wakeUpCall: string;
  quote: string;
  quoteAuthor: string;
  tacticalBreakdown: string;
  provider: AiProvider;
}

const SYSTEM_INSTRUCTION =
  'You are the EmpireOS Accountability Coach for an ambitious founder building a ₹1,000 Cr multi-venture empire across Fuel, Marketing, Tech, Construction Materials, Retail, and Personal Discipline. Your tone is razor-sharp, direct, respectful of greatness, and allergic to excuses. Always output valid JSON matching the exact schema.';

const TRIGGER_CONTEXT: Record<CoachTrigger, string> = {
  overdue: 'The scheduled execution time for this task just passed without completion.',
  rescheduled:
    'The founder just pushed/rescheduled this task to a later date instead of executing it today.',
  missed: 'The founder marked this task as missed.',
  manual:
    'The founder tapped Reality Check on a stalled task and needs an uncompromising push right now.',
};

function buildPrompt(input: RealityCheckInput): string {
  const pct = Math.max(0, Math.min(100, Math.round(Number(input.completionPercent) || 0)));
  return [
    `Venture / Business: ${input.businessName.slice(0, 80) || 'Empire Portfolio'}`,
    input.projectName ? `Project: ${input.projectName.slice(0, 100)}` : '',
    `Stalled / Missed Task: "${input.taskTitle.slice(0, 200)}"`,
    `Today's Empire Execution Rate: ${pct}%`,
    `Trigger: ${TRIGGER_CONTEXT[input.triggerReason] || TRIGGER_CONTEXT.manual}`,
    '',
    'Generate a sharp, high-standards executive Reality Check JSON object:',
    '1. wakeUpCall: Exactly 2 punchy, zero-fluff sentences reminding the founder that sitting around will not build a ₹1,000 Cr empire and demanding immediate execution on this exact task.',
    '2. quote: A real, verified, historically accurate quote from an iconic builder, elite athlete, or stoic philosopher (such as Dhirubhai Ambani, Jensen Huang, Marcus Aurelius, Kobe Bryant, Naval Ravikant, Charlie Munger, J.R.D. Tata, or Seneca). Never fabricate a quote.',
    '3. quoteAuthor: The exact author name.',
    '4. tacticalBreakdown: 2 to 3 crisp sentences explaining what the quote means in operational terms and giving one concrete, immediate action to complete this specific task in the next 15 minutes.',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseJsonLoose<T = Omit<RealityCheckResult, 'provider'>>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

const RC_KEYS = ['wakeUpCall', 'quote', 'quoteAuthor', 'tacticalBreakdown'];

async function callGemini<T = Omit<RealityCheckResult, 'provider'>>(
  apiKey: string,
  model: string,
  prompt: string,
  system: string = SYSTEM_INSTRUCTION,
  keys: string[] = RC_KEYS,
  schemaOverride?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schemaOverride || {
            type: 'OBJECT',
            properties: Object.fromEntries(keys.map((k) => [k, { type: 'STRING' }])),
            required: keys,
          },
        },
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text.trim()) throw new Error('Gemini returned an empty response.');
  return parseJsonLoose<T>(text);
}

async function callClaude<T = Omit<RealityCheckResult, 'provider'>>(
  apiKey: string,
  model: string,
  prompt: string,
  system: string = SYSTEM_INSTRUCTION,
  keys: string[] = RC_KEYS
): Promise<T> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: `${system} Respond ONLY with a valid JSON object containing exact keys: ${keys.join(', ')}. Do not wrap in markdown fences.`,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Claude request failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === 'text')?.text || '';
  if (!text.trim()) throw new Error('Claude returned an empty response.');
  return parseJsonLoose<T>(text);
}

export async function generateRealityCheck(input: RealityCheckInput): Promise<RealityCheckResult> {
  const provider: AiProvider = input.provider === 'claude' ? 'claude' : 'gemini';
  const apiKey = getCoachApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `No ${provider === 'claude' ? 'Claude (Anthropic)' : 'Gemini'} API key saved on this device. Add it in Settings → AI Accountability Coach.`
    );
  }
  if (!input.taskTitle.trim()) throw new Error('taskTitle is required.');
  const prompt = buildPrompt(input);
  const model = getCoachModel(provider);
  const parsed =
    provider === 'claude'
      ? await callClaude(apiKey, model, prompt)
      : await callGemini(apiKey, model, prompt);

  if (!parsed.wakeUpCall || !parsed.quote || !parsed.quoteAuthor || !parsed.tacticalBreakdown) {
    throw new Error('Incomplete response from the accountability engine.');
  }
  return {
    wakeUpCall: String(parsed.wakeUpCall).slice(0, 1000),
    quote: String(parsed.quote).slice(0, 600),
    quoteAuthor: String(parsed.quoteAuthor).slice(0, 120),
    tacticalBreakdown: String(parsed.tacticalBreakdown).slice(0, 1200),
    provider,
  };
}

// ---------------------------------------------------------------------------
// Lifetime performance review (Habits page KPIs)
// ---------------------------------------------------------------------------

export interface PerformanceReview {
  title: string;
  headline: string;
  motivation: string;
  strength: string;
  focus: string;
  awardName: string;
  awardReason: string;
  provider: AiProvider;
  createdAt: string;
}

const REVIEW_KEYS = ['title', 'headline', 'motivation', 'strength', 'focus', 'awardName', 'awardReason'];

export async function generatePerformanceReview(
  provider: AiProvider,
  stats: Record<string, string | number>
): Promise<PerformanceReview> {
  const p: AiProvider = provider === 'claude' ? 'claude' : 'gemini';
  const apiKey = getCoachApiKey(p);
  if (!apiKey) {
    throw new Error(
      `No ${p === 'claude' ? 'Claude (Anthropic)' : 'Gemini'} API key saved on this device. Add it in Settings → AI Accountability Coach.`
    );
  }
  const system =
    'You are the EmpireOS Performance Coach for an ambitious Indian founder running multiple ventures. You review lifetime execution KPIs and respond like an elite coach: honest, specific to the numbers, motivating, never generic, never fake praise. Always output valid JSON with the exact keys requested.';
  const prompt = [
    'Lifetime execution KPIs:',
    ...Object.entries(stats).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Return a JSON object:',
    '1. title: A short executor title (2-4 words) that captures who this founder is right now based on the numbers.',
    '2. headline: One punchy sentence verdict on their lifetime performance that cites at least one real number.',
    '3. motivation: 2-3 sentences of direct, high-standards motivation tied to their actual weak spot.',
    '4. strength: One sentence naming their strongest metric and why it matters.',
    '5. focus: One concrete action for the next 7 days that would move their weakest KPI.',
    '6. awardName: A creative award name (2-5 words) they have genuinely earned from these numbers. If the numbers are poor, award effort or a comeback, honestly.',
    '7. awardReason: One sentence explaining exactly which numbers earned the award.',
  ].join('\n');
  const model = getCoachModel(p);
  const parsed =
    p === 'claude'
      ? await callClaude<Record<string, string>>(apiKey, model, prompt, system, REVIEW_KEYS)
      : await callGemini<Record<string, string>>(apiKey, model, prompt, system, REVIEW_KEYS);
  const pick = (k: string, max: number) => String(parsed[k] ?? '').slice(0, max);
  if (!parsed.headline || !parsed.motivation) throw new Error('Incomplete review from the AI coach.');
  return {
    title: pick('title', 60),
    headline: pick('headline', 300),
    motivation: pick('motivation', 800),
    strength: pick('strength', 300),
    focus: pick('focus', 400),
    awardName: pick('awardName', 80),
    awardReason: pick('awardReason', 300),
    provider: p,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Voice capture: turn a spoken sentence into structured tasks
// ---------------------------------------------------------------------------

export interface VoiceTaskDraft {
  title: string;
  venture: string; // venture name or ""
  project: string; // project name or ""
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or ""
  priority: 'high' | 'standard';
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly';
  isMilestone: boolean;
}

export async function parseVoiceToTasks(
  provider: AiProvider,
  transcript: string,
  ctx: { today: string; weekday: string; ventures: string[]; projects: Array<{ name: string; venture: string }> }
): Promise<VoiceTaskDraft[]> {
  const p: AiProvider = provider === 'claude' ? 'claude' : 'gemini';
  const apiKey = getCoachApiKey(p);
  if (!apiKey) throw new Error('NO_KEY');
  const system =
    'You convert a busy Indian founder\'s spoken note (English, Hindi or Hinglish) into clean, actionable tasks for a task manager. Output only valid JSON.';
  const prompt = [
    `Today is ${ctx.weekday}, ${ctx.today} (timezone Asia/Kolkata).`,
    `Ventures: ${ctx.ventures.join(' | ') || '(none)'}`,
    `Projects: ${ctx.projects.map((x) => `${x.name} [${x.venture}]`).join(' | ') || '(none)'}`,
    '',
    `Spoken note: """${transcript.slice(0, 1500)}"""`,
    '',
    'Return {"tasks": [...]} where each task has:',
    '- title: short imperative task title in English (keep names/places as said), no date/time words',
    '- venture: exact name from the Ventures list that fits best, or "" if unclear',
    '- project: exact name from the Projects list if clearly mentioned, else ""',
    '- date: YYYY-MM-DD resolved from words like today, kal/tomorrow, parso, Friday, next week; default today',
    '- time: HH:mm 24h if a time is said (e.g. "11 baje" = 11:00, "shaam 5" = 17:00), else ""',
    '- priority: "high" if urgent/important/zaroori, else "standard"',
    '- repeat: "daily" | "weekdays" | "weekly" if they say every day/roz/har hafte etc., else "none"',
    '- isMilestone: true only if they call it a milestone',
    'Split separate actions into separate tasks.',
  ].join('\n');
  const model = getCoachModel(p);
  const schema = {
    type: 'OBJECT',
    properties: {
      tasks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            venture: { type: 'STRING' },
            project: { type: 'STRING' },
            date: { type: 'STRING' },
            time: { type: 'STRING' },
            priority: { type: 'STRING', enum: ['high', 'standard'] },
            repeat: { type: 'STRING', enum: ['none', 'daily', 'weekdays', 'weekly'] },
            isMilestone: { type: 'BOOLEAN' },
          },
          required: ['title', 'venture', 'project', 'date', 'time', 'priority', 'repeat', 'isMilestone'],
        },
      },
    },
    required: ['tasks'],
  };
  const parsed =
    p === 'claude'
      ? await callClaude<{ tasks?: VoiceTaskDraft[] }>(apiKey, model, prompt, system, ['tasks'])
      : await callGemini<{ tasks?: VoiceTaskDraft[] }>(apiKey, model, prompt, system, ['tasks'], schema);
  const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const timeOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  return list
    .filter((t) => t && String(t.title || '').trim())
    .slice(0, 10)
    .map((t) => ({
      title: String(t.title).trim().slice(0, 200),
      venture: String(t.venture || ''),
      project: String(t.project || ''),
      date: dateOk(String(t.date)) ? String(t.date) : ctx.today,
      time: timeOk(String(t.time)) ? String(t.time) : '',
      priority: t.priority === 'high' ? 'high' : 'standard',
      repeat: ['daily', 'weekdays', 'weekly'].includes(String(t.repeat)) ? (t.repeat as VoiceTaskDraft['repeat']) : 'none',
      isMilestone: Boolean(t.isMilestone),
    }));
}
