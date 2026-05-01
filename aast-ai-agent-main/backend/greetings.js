// backend/greetings.js
export function checkGreeting(query) {
  if (!query || typeof query !== "string") return null;
  const q = query.toLowerCase().trim();

  if (["hi", "hello", "hey"].includes(q)) return "Hello! How can I help you today?";
  if (q === "salam" || q === "salam alaikum") return "Wa alaikum assalam! How can I help?";
  if (q.includes("thank")) return "You're welcome! 😊";
  if (q.includes("bye")) return "Goodbye! Have a great day!";

  return null;
}
