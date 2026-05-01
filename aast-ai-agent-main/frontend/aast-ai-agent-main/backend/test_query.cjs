const fetch = require('node-fetch');

async function test() {
  console.log("Testing Factual Fast-Track...");
  const res1 = await fetch("http://localhost:8000/api/chatbot/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "who teaches blockchain?" })
  });
  const data1 = await res1.json();
  console.log("Response 1:", data1);

  console.log("\\nTesting Unknown Parse Fallback...");
  // Assuming a query that generates invalid JSON or unknown intent will fallback to GENERAL.
  const res2 = await fetch("http://localhost:8000/api/chatbot/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "qwertyuiop" })
  });
  const data2 = await res2.json();
  console.log("Response 2:", data2);
}

test();
