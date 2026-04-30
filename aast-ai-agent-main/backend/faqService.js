import fs from "fs";
import path from "path";

const faqPath = path.resolve("data/faq.json");
let faqData = [];
try {
  faqData = JSON.parse(fs.readFileSync(faqPath, "utf-8"));
} catch (err) {
  console.warn("⚠️ FAQ failed to load, using empty array");
}

export function searchFAQ(query) {
  const qNormalized = query.toLowerCase().trim();

  // 1) Exact match first
  for (const item of faqData) {
    if (qNormalized === item.question.toLowerCase().trim()) {
      console.log("[FAQ][MATCH] exact");
      return item;
    }
  }

  // 2) Keyword match
  for (const item of faqData) {
    if (item.keywords && item.keywords.some(k => qNormalized.includes(k.toLowerCase()))) {
      console.log("[FAQ][MATCH] keyword");
      return item;
    }
  }

  console.log("[FAQ][MISS]");
  return null;
}
