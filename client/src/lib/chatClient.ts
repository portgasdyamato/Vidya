type ChatResponse = {
  answer?: string;
  error?: string;
};

type SendOptions = {
  // optional full conversation history to send to backend
  messages?: Array<{ role: string; content: string }>;
  // called for each streaming chunk (if backend supports streaming)
  onChunk?: (chunk: string) => void;
  // signal to abort
  signal?: AbortSignal;
};

function getBackendBase(): string {
  // prefer explicit VITE_CHAT_BACKEND_URL, otherwise same-origin
  // Vite exposes env vars via import.meta.env
  const configured = (import.meta.env.VITE_CHAT_BACKEND_URL as string) || (process.env.REACT_APP_CHAT_BACKEND_URL as string) || "";
  if (configured && configured.trim()) return configured.replace(/\/$/, "");
  // same-origin default
  return "";
}

export async function sendChatToBackend(question: string, context: string, options: SendOptions = {}): Promise<ChatResponse> {
  const base = getBackendBase();
  const url = base ? `${base}/api/chat` : `/api/chat`;
  const apiKey = (import.meta.env.VITE_CHAT_BACKEND_KEY as string) || (process.env.REACT_APP_CHAT_BACKEND_KEY as string) || "";

  const body: any = { question };
  if (options.messages) body.messages = options.messages;
  else if (context) body.context = context;

  const headers: any = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // Try streaming endpoint first (server may return chunked text/plain or text/event-stream)
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: options.signal });
    if (!res.ok) {
      const txt = await res.text();
      return { error: `Chat backend returned ${res.status}: ${txt}` };
    }

    // If the response is JSON, parse normally
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (typeof data.answer === "string") return { answer: data.answer };
      if (typeof data.message === "string") return { answer: data.message };
      if (data.messages && Array.isArray(data.messages)) {
        const assistant = data.messages.find((m: any) => m.role === "assistant");
        if (assistant) return { answer: assistant.content };
      }
      return { error: "Unexpected JSON response from chat backend" };
    }

    // Otherwise try streaming text chunks
    if (!res.body) {
      const txt = await res.text();
      return { answer: txt };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let accumulated = "";
    while (!done) {
      const { value, done: d } = await reader.read();
      done = !!d;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        if (options.onChunk) options.onChunk(chunk);
      }
    }

    // Try to parse JSON at the end, otherwise return text
    try {
      const parsed = JSON.parse(accumulated);
      if (typeof parsed.answer === "string") return { answer: parsed.answer };
      if (parsed.messages && Array.isArray(parsed.messages)) {
        const assistant = parsed.messages.find((m: any) => m.role === "assistant");
        if (assistant) return { answer: assistant.content };
      }
    } catch {
      // not JSON
    }

    return { answer: accumulated };
  } catch (err: any) {
    return { error: err?.message || String(err) };
  }
}
