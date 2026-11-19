const META_INTENTS = {
  LAST_QUESTION: "LAST_QUESTION",
  PREVIOUS_TOPIC: "PREVIOUS_TOPIC",
  LAST_ASSISTANT_RESPONSE: "LAST_ASSISTANT_RESPONSE",
  CONTINUE_TOPIC: "CONTINUE_TOPIC",
  CONVERSATION_SUMMARY: "CONVERSATION_SUMMARY",
  PREVIOUS_ANSWER_SUMMARY: "PREVIOUS_ANSWER_SUMMARY",
  SIMPLIFY_PREVIOUS: "SIMPLIFY_PREVIOUS"
};

const TOPIC_LABELS = {
  teaching_staff: "teaching staff",
  requirements: "requirements",
  careers: "career planning",
  program: "programs and courses",
  fees: "fees and scholarships",
  policy: "academic policies",
  KG_DIRECT: "knowledge graph facts",
  KG_ONLY: "knowledge graph facts",
  RAG_DIRECT: "academic policy context",
  RAG_ONLY: "academic policy context",
  HYBRID_KG_RAG: "academic facts and policy context",
  DECISION_ENGINE: "admission recommendations",
  CAREER_ENGINE: "career planning",
  FAQ: "general AAST information"
};

function normalizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

export function extractRequestedBulletCount(query) {
  const text = normalizeQuery(query);
  const wordNumbers = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5
  };
  const match = text.match(/\b(?:in|as|into)?\s*(one|two|three|four|five|[1-5])\s+(?:concise\s+|short\s+)?(?:bullet|bullets|point|points)\b/);
  if (!match) return null;
  return wordNumbers[match[1]] || Number.parseInt(match[1], 10) || null;
}

const TOKEN_SYNONYMS = {
  ask: "ask",
  asked: "ask",
  asking: "ask",
  question: "question",
  questions: "question",
  query: "question",
  queries: "question",
  last: "previous",
  previous: "previous",
  before: "previous",
  earlier: "previous",
  previously: "previous",
  discuss: "discuss",
  discussed: "discuss",
  discussing: "discuss",
  discussion: "discuss",
  talking: "discuss",
  talk: "discuss",
  topic: "topic",
  conversation: "conversation",
  chat: "conversation",
  continue: "continue",
  resume: "continue",
  summarize: "summary",
  summarise: "summary",
  summary: "summary",
  recap: "summary",
  say: "say",
  said: "say",
  tell: "say",
  told: "say",
  answer: "answer",
  answered: "answer",
  response: "answer",
  respond: "answer",
  responded: "answer",
  reply: "answer",
  replied: "answer"
};

const META_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "our",
  "this",
  "that",
  "was",
  "were",
  "is",
  "are",
  "do",
  "did",
  "does",
  "what",
  "where",
  "we",
  "i",
  "me",
  "you",
  "your",
  "please"
]);

const FUZZY_META_PHRASES = [
  { phrase: "what was my last question", type: META_INTENTS.LAST_QUESTION },
  { phrase: "what was last question", type: META_INTENTS.LAST_QUESTION },
  { phrase: "what did i ask before", type: META_INTENTS.LAST_QUESTION },
  { phrase: "what did i ask you", type: META_INTENTS.LAST_QUESTION },
  { phrase: "what were we discussing", type: META_INTENTS.PREVIOUS_TOPIC },
  { phrase: "continue previous topic", type: META_INTENTS.CONTINUE_TOPIC },
  { phrase: "continue", type: META_INTENTS.CONTINUE_TOPIC },
  { phrase: "what did you say earlier", type: META_INTENTS.LAST_ASSISTANT_RESPONSE },
  { phrase: "summarize conversation", type: META_INTENTS.CONVERSATION_SUMMARY },
  { phrase: "recap our discussion", type: META_INTENTS.CONVERSATION_SUMMARY }
];

function canonicalTokens(text) {
  return normalizeQuery(text)
    .split(/\s+/)
    .map(token => TOKEN_SYNONYMS[token] || token)
    .filter(token => token && !META_STOPWORDS.has(token));
}

function hasToken(tokens, token) {
  return tokens.includes(token);
}

function hasAnyToken(tokens, values) {
  return values.some(value => tokens.includes(value));
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function detectSemanticMetaIntent(text) {
  const tokens = canonicalTokens(text);
  if (tokens.length === 0) return null;

  const tokenSet = [...new Set(tokens)];
  const compact = tokenSet.join(" ");

  for (const item of FUZZY_META_PHRASES) {
    const phraseCompact = canonicalTokens(item.phrase).join(" ");
    const distance = levenshteinDistance(compact, phraseCompact);
    const maxDistance = phraseCompact.length <= 8 ? 1 : 2;
    if (distance > 0 && distance <= maxDistance) {
      return { type: item.type, confidence: 0.92, source: "lightweight_fuzzy_phrase" };
    }
  }

  if (
    hasAnyToken(tokens, ["question", "ask"]) &&
    (hasToken(tokens, "previous") || text.includes("did i ask you"))
  ) {
    return { type: META_INTENTS.LAST_QUESTION, confidence: 0.96, source: "semantic_token_family" };
  }

  if (
    hasToken(tokens, "continue") &&
    (tokens.length <= 2 || hasAnyToken(tokens, ["previous", "topic", "conversation", "discuss"]))
  ) {
    return { type: META_INTENTS.CONTINUE_TOPIC, confidence: 0.96, source: "semantic_token_family" };
  }

  if (
    hasAnyToken(tokens, ["discuss", "topic"]) &&
    (text.includes("we") || hasAnyToken(tokens, ["previous", "conversation"]))
  ) {
    return { type: META_INTENTS.PREVIOUS_TOPIC, confidence: 0.95, source: "semantic_token_family" };
  }

  if (
    hasAnyToken(tokens, ["say", "answer"]) &&
    (text.includes("you") || text.includes("your")) &&
    (hasToken(tokens, "previous") || hasAnyToken(tokens, ["say", "answer"]))
  ) {
    return { type: META_INTENTS.LAST_ASSISTANT_RESPONSE, confidence: 0.95, source: "semantic_token_family" };
  }

  if (
    hasToken(tokens, "summary") &&
    (tokens.length <= 2 || hasAnyToken(tokens, ["conversation", "discuss"]))
  ) {
    return { type: META_INTENTS.CONVERSATION_SUMMARY, confidence: 0.96, source: "semantic_token_family" };
  }

  return null;
}

export function detectMetaConversationIntent(query) {
  const text = normalizeQuery(query);
  if (!text) return null;
  const bulletCount = extractRequestedBulletCount(query);

  if (matchesAny(text, [
    /^(summarize|summarise|recap) (that|this|your last answer|the last answer|the previous answer)\b/,
    /^(summarize|summarise|recap) what you just (said|answered)\b/
  ])) {
    return {
      type: META_INTENTS.PREVIOUS_ANSWER_SUMMARY,
      confidence: 1,
      source: "deterministic_regex",
      bulletCount
    };
  }

  if (matchesAny(text, [
    /^(explain|say|state|rewrite|restate) (that|this|your last answer|the previous answer) (more )?(simply|plainly|clearly)$/,
    /^(make|put) (that|this|your last answer) (more )?(simple|plain|clear)$/,
    /^in simpler (words|terms)$/
  ])) {
    return {
      type: META_INTENTS.SIMPLIFY_PREVIOUS,
      confidence: 1,
      source: "deterministic_regex"
    };
  }

  if (matchesAny(text, [
    /^(what|whats|what is|what was) my last (question|query)$/,
    /^(what|whats|what is|what was) last (question|query)$/,
    /^(what|whats|what is|what was) (the )?last (question|query) i asked( you)?$/,
    /^what did i ask( you)?( last| earlier| before| previously)?$/,
    /^what did i ask( you)? (last|earlier|before|previously)$/,
    /^what did i say (last|earlier|before|previously)$/,
    /\b(my|the) (last|previous) (question|query)\b/,
    /^previous question$/,
    /^last thing i asked$/
  ])) {
    return { type: META_INTENTS.LAST_QUESTION, confidence: 1, source: "deterministic_regex" };
  }

  if (matchesAny(text, [
    /^(what|whats|what is|what was) (the )?last (question|query) i asked( you)? about$/,
    /^what did i ask( you)? about$/
  ])) {
    return {
      type: META_INTENTS.LAST_QUESTION,
      confidence: 1,
      source: "deterministic_regex",
      questionAbout: true
    };
  }

  if (matchesAny(text, [
    /^(continue|resume|carry on|go on)$/,
    /^(continue|resume|carry on|go on) (the |our )?(previous|last|same)? ?(topic|discussion|conversation)$/,
    /\bcontinue (the |our )?(previous|last|same) (topic|discussion)\b/,
    /^continue previous topic$/,
    /^continue where we stopped$/,
    /^continue where we left off$/
  ])) {
    return { type: META_INTENTS.CONTINUE_TOPIC, confidence: 1, source: "deterministic_regex" };
  }

  if (matchesAny(text, [
    /^what (were|was) we (discussing|talking about)$/,
    /^what (is|was) (the )?(previous|last) topic$/,
    /^where did we leave off$/,
    /^previous topic$/,
    /\b(previous|last) (topic|discussion)\b/
  ])) {
    return { type: META_INTENTS.PREVIOUS_TOPIC, confidence: 1, source: "deterministic_regex" };
  }

  if (matchesAny(text, [
    /^what did you (say|tell me|answer|respond)( earlier| before| last)?$/,
    /^(what was|what is) your last (answer|response|reply)$/,
    /^(what was|what is) your previous (answer|response|reply)$/,
    /^repeat your last (answer|response|reply)$/,
    /\b(your|the) last (answer|response|reply)\b/,
    /\bwhat did you say earlier\b/
  ])) {
    return { type: META_INTENTS.LAST_ASSISTANT_RESPONSE, confidence: 1, source: "deterministic_regex" };
  }

  if (matchesAny(text, [
    /^(summarize|summarise|recap) (our|this|the) conversation$/,
    /^(summarize|summarise|recap) conversation$/,
    /^(summarize|summarise|recap) discussion$/,
    /^(summarize|summarise|recap) our discussion$/,
    /^(summarize|summarise|recap) (our|this|the) chat$/,
    /^(summarize|summarise|recap) (our|this|the) discussion$/,
    /^conversation summary$/,
    /^what have we discussed so far$/,
    /^(summarize|summarise|recap) (only )?(the |your )?(verified )?(advice|answers|guidance) (you )?(gave|provided|shared|gave me)?/,
    /^(summarize|summarise|recap).*\b(this|our|the) conversation\b/,
    /^(summarize|summarise|recap) the advice you gave me\b/
  ])) {
    return {
      type: META_INTENTS.CONVERSATION_SUMMARY,
      confidence: 1,
      source: "deterministic_regex",
      bulletCount
    };
  }

  return detectSemanticMetaIntent(text);
}

export const detectConversationUtilityIntent = detectMetaConversationIntent;

function cleanText(value, limit = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : "";
}

function formatList(items) {
  const values = [...new Set(items.map(item => cleanText(item, 80)).filter(Boolean))];
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatTopic(topic) {
  const value = cleanText(topic, 80);
  if (!value) return "";
  return TOPIC_LABELS[value] || value.replace(/_/g, " ").toLowerCase();
}

function isMetaUserMessage(message) {
  return Boolean(detectMetaConversationIntent(message?.content || message?.text || ""));
}

function isMetaAssistantResponse(message) {
  const text = cleanText(message?.content || message?.text || "", 220).toLowerCase();
  return /^(your last question was|we were discussing|we were on|my last answer was|i said:|so far, we discussed)/.test(text);
}

function findLastUserQuestion(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    if (isMetaUserMessage(message)) continue;
    const text = cleanText(message.content || message.text);
    if (text) return text;
  }
  return "";
}

function findLastAssistantResponse(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    if (isMetaAssistantResponse(message)) continue;
    const text = cleanText(message.content || message.text, 220);
    if (text) return text;
  }
  return "";
}

function buildTopicPhrase(memory = {}, messages = []) {
  const topic = formatTopic(memory.lastTopic);
  const subjects = Array.isArray(memory.recentSubjects) ? memory.recentSubjects : [];
  const subjectPhrase = formatList(subjects.slice(0, 3));

  if (topic && subjectPhrase) return `${topic}, especially ${subjectPhrase}`;
  if (subjectPhrase) return subjectPhrase;
  if (topic) return topic;

  const lastQuestion = findLastUserQuestion(messages);
  return lastQuestion ? `your earlier question: "${lastQuestion}"` : "";
}

function lowercaseFirst(text) {
  const value = cleanText(text, 220).replace(/[?!.]+$/g, "");
  if (!value) return "";
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function getVerifiedTurns(memory = {}) {
  return (Array.isArray(memory.verifiedTurns) ? memory.verifiedTurns : [])
    .filter(turn => turn && cleanText(turn.answer, 1200))
    .slice()
    .reverse();
}

function splitGroundedSentences(value) {
  return String(value || "")
    .replace(/\[[^\]]{1,80}\]/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => cleanText(sentence, 600))
    .filter(Boolean);
}

function compactVerifiedAnswers(turns, limit = 650) {
  const sentences = [];
  const seen = new Set();
  for (const turn of turns) {
    for (const sentence of splitGroundedSentences(turn.answer)) {
      const key = normalizeQuery(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
    }
  }

  let result = "";
  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > limit) break;
    result = next;
  }
  return result;
}

function classifyVerifiedTurn(turn) {
  const relations = new Set(
    (Array.isArray(turn.relations) ? turn.relations : [])
      .map(relation => String(relation || "").toUpperCase())
  );
  const query = normalizeQuery(turn.query);

  if (
    [...relations].some(relation =>
      ["TEACHES", "HEAD_OF", "HEAD_OF_UNIT", "DEAN_OF", "HAS_ROLE", "ACTS_AS"].includes(relation)
    )
  ) {
    return "people";
  }
  if (
    [...relations].some(relation =>
      ["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR", "RECOMMENDED_AFTER"].includes(relation)
    ) ||
    /\b(prerequisite|before taking|recommended after|which of .* includes machine learning)\b/.test(query)
  ) {
    return "course";
  }
  return "program";
}

function buildThreePartVerifiedSummary(turns) {
  const groups = {
    program: [],
    course: [],
    people: []
  };
  for (const turn of turns) groups[classifyVerifiedTurn(turn)].push(turn);

  const labels = [
    ["program", "Programs and careers"],
    ["course", "Course path"],
    ["people", "Faculty and leadership"]
  ];
  const bullets = labels
    .map(([key, label]) => {
      const text = compactVerifiedAnswers(groups[key], 650);
      return text ? `- ${label}: ${text}` : "";
    })
    .filter(Boolean);

  if (bullets.length === 3) return bullets.join("\n");

  const fallback = compactVerifiedAnswers(turns, 1500);
  const sentences = splitGroundedSentences(fallback);
  if (sentences.length === 0) return "";
  return Array.from({ length: 3 }, (_, index) => {
    const bucket = sentences.filter((_, sentenceIndex) => sentenceIndex % 3 === index);
    return bucket.length > 0 ? `- ${bucket.join(" ")}` : "";
  }).filter(Boolean).join("\n");
}

function buildExtractiveBulletSummary(value, count) {
  const sentences = splitGroundedSentences(value);
  if (sentences.length === 0) return "";
  const bulletCount = Math.max(1, Math.min(Number(count) || 3, 5));
  const buckets = Array.from({ length: Math.min(bulletCount, sentences.length) }, () => []);
  sentences.forEach((sentence, index) => buckets[index % buckets.length].push(sentence));
  return buckets.map(bucket => `- ${bucket.join(" ")}`).join("\n");
}

export function buildConversationMetaResponse(intent, { messages = [], conversationMemory = {} } = {}) {
  const type = typeof intent === "string" ? intent : intent?.type;
  const memory = conversationMemory || {};

  if (type === META_INTENTS.LAST_QUESTION) {
    const lastQuestion = findLastUserQuestion(messages);
    if (intent?.questionAbout) {
      const topicPhrase = lowercaseFirst(lastQuestion) || buildTopicPhrase(memory, messages);
      return topicPhrase
        ? `Your last question was about ${topicPhrase}.`
        : "I do not have a previous question in this conversation yet.";
    }
    return lastQuestion
      ? `Your last question was: "${lastQuestion}"`
      : "I do not have a previous question in this conversation yet.";
  }

  if (type === META_INTENTS.PREVIOUS_TOPIC) {
    const topicPhrase = buildTopicPhrase(memory, messages);
    return topicPhrase
      ? `We were discussing ${topicPhrase}.`
      : "We have not settled on a previous topic in this conversation yet.";
  }

  if (type === META_INTENTS.CONTINUE_TOPIC) {
    const topicPhrase = buildTopicPhrase(memory, messages);
    return topicPhrase
      ? `We were on ${topicPhrase}. Send me the next question about it and I will continue from there.`
      : "I do not have a previous topic to continue yet.";
  }

  if (type === META_INTENTS.LAST_ASSISTANT_RESPONSE) {
    const summary =
      cleanText(memory.lastVerifiedAssistantAnswer, 1200) ||
      cleanText(memory.lastAssistantSummary, 220) ||
      findLastAssistantResponse(messages);
    return summary
      ? `My last answer was: ${summary}`
      : "I do not have an earlier assistant answer in this conversation yet.";
  }

  if (type === META_INTENTS.PREVIOUS_ANSWER_SUMMARY) {
    const verifiedAnswer = cleanText(memory.lastVerifiedAssistantAnswer, 1200);
    if (!verifiedAnswer) {
      return "I do not have a verified earlier answer to summarize yet.";
    }
    const bulletCount = intent?.bulletCount || 3;
    const summary = buildExtractiveBulletSummary(verifiedAnswer, bulletCount);
    return summary || "I do not have enough verified content to summarize yet.";
  }

  if (type === META_INTENTS.SIMPLIFY_PREVIOUS) {
    const verifiedAnswer = cleanText(memory.lastVerifiedAssistantAnswer, 1200);
    if (!verifiedAnswer) {
      return "I do not have a verified earlier answer to restate yet.";
    }
    const sentences = splitGroundedSentences(verifiedAnswer).slice(0, 3);
    return `Simply put: ${sentences.join(" ")}`;
  }

  if (type === META_INTENTS.CONVERSATION_SUMMARY) {
    const verifiedTurns = getVerifiedTurns(memory);
    if (verifiedTurns.length === 0) {
      return "There is not enough verified conversation history to summarize yet.";
    }
    if ((intent?.bulletCount || 0) === 3) {
      return buildThreePartVerifiedSummary(verifiedTurns);
    }
    const combined = compactVerifiedAnswers(verifiedTurns, 1800);
    return intent?.bulletCount
      ? buildExtractiveBulletSummary(combined, intent.bulletCount)
      : `Verified conversation summary: ${combined}`;
  }

  return "I can help with the previous conversation context, but I do not have enough history yet.";
}

export { META_INTENTS };
