const num = (v: string | undefined) => Number(v ?? 0) || 0;

export const vaaniCostInr = (durationSec: number) =>
  (durationSec / 60) * num(process.env.VAANI_COST_PER_MIN_INR);

export const geminiCostInr = (inputTokens: number, outputTokens: number) =>
  (inputTokens / 1e6) * num(process.env.GEMINI_INPUT_INR_PER_M_TOKENS) +
  (outputTokens / 1e6) * num(process.env.GEMINI_OUTPUT_INR_PER_M_TOKENS);

export const fixedMonthlyCostInr = () => num(process.env.FIXED_MONTHLY_COST_INR);

/** True while any rate is left at its 0 placeholder, so the dashboard can say the cost is incomplete. */
export const costRatesMissing = () =>
  !num(process.env.VAANI_COST_PER_MIN_INR) ||
  !num(process.env.GEMINI_INPUT_INR_PER_M_TOKENS) ||
  !num(process.env.FIXED_MONTHLY_COST_INR);
