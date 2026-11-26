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

function parseJsonLoose(text: string): Omit<RealityCheckResult, 'provider'> {
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

async function callGemini(apiKey: string, model: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              wakeUpCall: { type: 'STRING' },
              quote: { type: 'STRING' },
              quoteAuthor: { type: 'STRING' },
              tacticalBreakdown: { type: 'STRING' },
            },
            required: ['wakeUpCall', 'quote', 'quoteAuthor', 'tacticalBreakdown'],
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
  return parseJsonLoose(text);
}

async function callClaude(apiKey: string, model: string, prompt: string) {
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
      system: `${SYSTEM_INSTRUCTION} Respond ONLY with a valid JSON object containing exact keys: wakeUpCall, quote, quoteAuthor, tacticalBreakdown. Do not wrap in markdown fences.`,
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
  return parseJsonLoose(text);
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
