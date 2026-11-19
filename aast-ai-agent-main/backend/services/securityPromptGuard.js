const PROMPT_OVERRIDE_RULES = Object.freeze([
  {
    reason: "ROLE_PREFIX_OVERRIDE",
    pattern: /^\s*(?:system|assistant|developer|model|tool|function)\s*:/i
  },
  {
    reason: "INSTRUCTION_OVERRIDE",
    pattern: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|rules?|constraints?|univer(?:sity|stiy)\s+data)\b/i
  },
  {
    reason: "SECRET_EXFILTRATION",
    pattern: /\b(?:reveal|show|print|expose|leak|return)\b[\s\S]{0,80}\b(?:api\s*keys?|secrets?|credentials?|access\s*tokens?|passwords?|environment\s+variables?)\b/i
  },
  {
    reason: "PRIVILEGE_OVERRIDE",
    pattern: /\b(?:jailbreak|developer\s+mode|bypass\s+(?:the\s+)?(?:rules?|restrictions?|safety)|you\s+are\s+now\s+unrestricted)\b/i
  },
  {
    reason: "ROLE_TAG_OVERRIDE",
    pattern: /<\s*\/?\s*(?:system|assistant|developer|model|tool|function)\b/i
  },
  {
    reason: "STRUCTURED_OVERRIDE",
    pattern: /["']?(?:override|reveal_secrets|system_prompt)["']?\s*:/i
  }
]);

export const SECURITY_REFUSAL_MESSAGE =
  "I cannot follow instructions that override system safety or expose private credentials. Please ask an academic question about AAST.";

export function detectPromptInjectionAttempt(input) {
  const text = String(input || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (!text) return { detected: false, reason: null };

  const match = PROMPT_OVERRIDE_RULES.find(rule => rule.pattern.test(text));
  return match
    ? { detected: true, reason: match.reason }
    : { detected: false, reason: null };
}

export default {
  detectPromptInjectionAttempt,
  SECURITY_REFUSAL_MESSAGE
};
