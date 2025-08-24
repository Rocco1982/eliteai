// api/assistant.js
// Node serverless route (works on Vercel). Simple thread/run flow for Assistants v2.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    const { message, threadId } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
    const BASE = "https://api.openai.com/v1";
    const headers = {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2"
    };

    let tid = threadId;

    // 1) create a thread if none provided
    if (!tid) {
      const createThread = await fetch(`${BASE}/threads`, { method: "POST", headers });
      if (!createThread.ok) {
        const ttext = await createThread.text();
        throw new Error("Create thread error: " + ttext);
      }
      const tjson = await createThread.json();
      tid = tjson.id;
    }

    // 2) post user message to thread
    const postMsg = await fetch(`${BASE}/threads/${tid}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: "user", content: message })
    });
    if (!postMsg.ok) {
      const text = await postMsg.text();
      throw new Error("Post message error: " + text);
    }

    // 3) run the assistant on the thread
    const runRes = await fetch(`${BASE}/threads/${tid}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });
    if (!runRes.ok) {
      const t = await runRes.text();
      throw new Error("Run assistant error: " + t);
    }
    const runJson = await runRes.json();

    // 4) poll until completed
    let status = runJson.status;
    const runId = runJson.id;
    const pollLimit = 40; // safety cap
    let polls = 0;
    while (status !== "completed" && status !== "failed" && polls < pollLimit) {
      await new Promise(r => setTimeout(r, 900));
      const check = await fetch(`${BASE}/threads/${tid}/runs/${runId}`, { headers });
      const checkJson = await check.json();
      status = checkJson.status;
      polls++;
    }
    if (status === "failed") throw new Error("Assistant run failed");

    // 5) fetch messages and return last assistant message
    const msgsRes = await fetch(`${BASE}/threads/${tid}/messages`, { headers });
    if (!msgsRes.ok) {
      const t = await msgsRes.text();
      throw new Error("Fetch messages error: " + t);
    }
    const msgsJson = await msgsRes.json();
    // find the most recent assistant message
    const assistantMsg = (msgsJson.data || []).reverse().find(m => m.role === "assistant");

    // content can be in different shapes; attempt to extract text
    let reply = "";
    if (assistantMsg) {
      const content = assistantMsg.content || [];
      // content might be array of parts; try to extract text fields
      reply = content.map(block => {
        if (!block) return "";
        if (typeof block === "string") return block;
        // block.text?.value or block.text
        if (block.text && typeof block.text === "object" && block.text.value) return block.text.value;
        if (block.text && typeof block.text === "string") return block.text;
        // sometimes content can be an object with 'type' and 'value'
        if (block.type === "output_text" && block.parts) return block.parts.join("");
        return JSON.stringify(block);
      }).join("\n").trim();
    }

    return res.json({ reply, threadId: tid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
