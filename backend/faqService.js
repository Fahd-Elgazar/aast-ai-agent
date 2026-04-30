import fs from "fs";
import path from "path";

const faqPath = path.resolve("data/faq.json");
const faqData = JSON.parse(fs.readFileSync(faqPath, "utf-8"));

export function searchFAQ(query) {
  const q = query.toLowerCase();

  // 1) Exact keyword match inside the question (old behavior)
  for (const item of faqData) {
    if (q.includes(item.question.toLowerCase().split(" ")[0])) {
      return item;
    }
  }

  // 2) Tag match (new behavior)
  for (const item of faqData) {
    if (item.tags && item.tags.some(tag => q.includes(tag.toLowerCase()))) {
      return item;
    }
  }

  return null;
}
