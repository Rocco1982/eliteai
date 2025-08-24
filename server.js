const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID;

let threadId = null;

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });

    if (!threadId) {
      const thread = await client.beta.threads.create();
      threadId = thread.id;
      console.log("🧵 New thread:", threadId);
    }

    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    const run = await client.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    let runStatus = await client.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(r => setTimeout(r, 800));
      runStatus = await client.beta.threads.runs.retrieve(threadId, run.id);
    }

    const list = await client.beta.threads.messages.list(threadId);
    const reply = list.data[0].content[0].text.value;

    res.json({ reply, threadId });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Assistant error" });
  }
});

app.post("/reset", (_req, res) => {
  threadId = null;
  console.log("🔄 Thread reset");
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
