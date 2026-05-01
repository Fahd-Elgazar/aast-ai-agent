import type { GraphData } from "../types";

export async function sendMessageToAdvisor(
  text: string,
  context?: string
): Promise<{ responseText: string; graphUpdate?: GraphData | null }> {

  await new Promise(r => setTimeout(r, 700)); // fake delay

  if (/graph|visual|show/i.test(text)) {
    return {
      responseText: "Here is a sample knowledge graph:",
      graphUpdate: {
        nodes: [
          { id: "You", group: 1, label: "Student" },
          { id: "AI", group: 2, label: "AI Course" },
          { id: "CV", group: 2, label: "Computer Vision" },
        ],
        links: [
          { source: "You", target: "AI", value: 1 },
          { source: "You", target: "CV", value: 1 },
        ],
      }
    };
  }

  return {
    responseText: `Advisor reply: "${text}"`,
    graphUpdate: null
  };
}
