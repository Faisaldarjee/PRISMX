import { GoogleGenAI } from "@google/genai";

const cleanEnvVar = (value: any): string => {
  if (typeof value !== 'string') return '';
  let trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.substring(1, trimmed.length - 1);
  }
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    trimmed = trimmed.substring(1);
  }
  if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
    trimmed = trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed.trim();
};

const apiKey = cleanEnvVar(process.env.GEMINI_API_KEY);
export const ai = apiKey
  ? new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    })
  : null;

// Track daily usage inside global memory state
const geminiUsage = {
  count: 0,
  date: new Date().toDateString(),
  limit: 40  // Stay well under standard free tier limit
};

export function canCallGemini(): boolean {
  const today = new Date().toDateString();
  if (geminiUsage.date !== today) {
    // Midnight reset
    geminiUsage.count = 0;
    geminiUsage.date = today;
  }
  return geminiUsage.count < geminiUsage.limit;
}

export function trackGeminiCall() {
  const today = new Date().toDateString();
  if (geminiUsage.date !== today) {
    geminiUsage.count = 0;
    geminiUsage.date = today;
  }
  geminiUsage.count++;
  console.log(`[Gemini Quota Tracker] Completed call ${geminiUsage.count}/${geminiUsage.limit} for today.`);
}

export function getGeminiUsageCount(): number {
  return geminiUsage.count;
}

let isRateLimited = false;
let rateLimitResetTime = 0;

export function isGeminiSuspended(): boolean {
  // Check daily quota first
  if (!canCallGemini()) {
    console.warn(`[Gemini Quota Tracker] Daily limit of ${geminiUsage.limit} calls reached — suspending Gemini features globally.`);
    return true;
  }

  const now = Date.now();
  if (isRateLimited && now < rateLimitResetTime) {
    return true;
  }
  if (isRateLimited && now >= rateLimitResetTime) {
    isRateLimited = false;
    rateLimitResetTime = 0;
  }
  return false;
}

export function handleGeminiError(err: any, context?: string) {
  let errMsg = "";
  try {
    errMsg = (err?.message || String(err)).toLowerCase();
    if (err?.status) {
      errMsg += " " + String(err.status).toLowerCase();
    }
    if (err?.error && typeof err.error === 'object') {
      errMsg += " " + JSON.stringify(err.error).toLowerCase();
    }
  } catch (e) {
    errMsg = String(err).toLowerCase();
  }

  const isRateLimit = 
    errMsg.includes("429") ||
    errMsg.includes("quota") ||
    errMsg.includes("rate exceeded") ||
    errMsg.includes("rate limit") ||
    errMsg.includes("resource_exhausted") ||
    errMsg.includes("resource has been exhausted") ||
    errMsg.includes("exhausted") ||
    errMsg.includes("billing");

  if (isRateLimit) {
    console.log(`[Gemini State] ${context ? `[${context}] ` : ''}Rate limit or Free Tier Quota reached. Suspending Gemini features globally for 3 minutes, using high-quality deterministic model fallbacks.`);
    isRateLimited = true;
    rateLimitResetTime = Date.now() + 180 * 1000; // 3 minutes cooling period
  }
}

export async function callGeneratedContentWithRetry(params: {
  model: string;
  contents: any;
  config?: any;
}, maxRetries = 3): Promise<any> {
  if (!ai) throw new Error("API has not been configured.");
  if (isGeminiSuspended()) throw new Error("API is temporarily suspended due to rate limiting.");

  const modelsToTry = [params.model, "gemini-flash-latest", "gemini-3.5-flash"];
  const models = Array.from(new Set(modelsToTry));

  let lastError: any = null;

  for (const model of models) {
    if (isGeminiSuspended()) break;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        trackGeminiCall();
        return response;
      } catch (error: any) {
        lastError = error;
        const msg = (error?.message || String(error)).toLowerCase();
        
        const isQuotaExceeded = msg.includes("429") || 
                                msg.includes("quota") || 
                                msg.includes("exceeded") ||
                                msg.includes("rate limit") ||
                                msg.includes("exhausted") ||
                                msg.includes("resource_exhausted");

        const isTransient = msg.includes("503") || 
                            msg.includes("demand") || 
                            msg.includes("temporary") ||
                            msg.includes("unavailable") ||
                            isQuotaExceeded;

        console.warn(`[Gemini API] Attempt ${attempt} failed for model "${model}". Error: ${error?.message || msg}. Transient? ${isTransient}`);

        if (isQuotaExceeded) {
          // Immediately suspend Gemini globally and abort to avoid spamming the rate-limited API key
          handleGeminiError(error, `Generate-Quick-Suspend-${model}`);
          break; // Break current model's attempt loop
        }

        if (!isTransient && attempt === maxRetries) {
          break;
        }

        if (attempt < maxRetries) {
          const is503 = msg.includes("503") || msg.includes("demand") || msg.includes("unavailable");
          const baseDelay = is503 ? 1500 : 1000;
          const delay = attempt * baseDelay + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  // If we reach here, all retries and fallback models failed. Mark Gemini as suspended globally
  if (lastError) {
    handleGeminiError(lastError, `Agent-Fallback-Exhausted`);
  }

  throw lastError || new Error("Failed to generate content after retry & fallback models");
}

