let conversationId: string | null = null;

export async function sendMessageToAdvisor(
  message: string,
  context?: string
): Promise<{ responseText: string }> {
  try {
    const res = await fetch('/api/chatbot/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        cid: conversationId,
      }),
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();

    // 🔑 STORE CID FOR NEXT MESSAGE
    if (data.cid) {
      conversationId = data.cid;
    }

    return {
      responseText: data.answer,
    };
  } catch (error) {
    console.error('Advisor backend error:', error);

    return {
      responseText:
        'Sorry, I am currently unable to reach the advisor service.',
    };
  }
}
