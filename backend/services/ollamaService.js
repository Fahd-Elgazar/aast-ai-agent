import fetch from "node-fetch";

export async function callOllama(prompt, model = "llama3.2:3b-instruct-q4_K_M") {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  const data = await res.json();
  return data.response?.trim();
}