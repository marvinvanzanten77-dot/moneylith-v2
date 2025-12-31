import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const MODEL = "gpt-4.1-mini";

// Moneylith analyse proxy
app.post("/api/moneylith/analyse", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const { system, user } = req.body || {};

  if (!system || !user) {
    return res.status(400).json({ error: "Missing system/user payload" });
  }

  if (!apiKey) {
    const fallback =
      "AI offline: gebruik mock analyse.\n" +
      "- Inkomsten: geen analyse\n" +
      "- Vaste lasten: geen analyse\n" +
      "- Schulden/Doelen: geen analyse";
    return res.status(200).json({ content: fallback });
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
    return res.status(200).json({ content });
  } catch (error) {
    console.error("Moneylith AI error", error);
    const fallback =
      "AI call mislukte; gebruik mock analyse.\n" +
      "- Controleer je OPENAI_API_KEY\n" +
      "- Probeer later opnieuw";
    return res.status(200).json({ content: fallback });
  }
});

// Serve built frontend
app.use(express.static("dist"));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
