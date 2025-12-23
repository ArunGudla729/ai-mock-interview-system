import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const testKey = async () => {
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: "Hello world" }]
      })
    });
    const data = await res.json();
    console.log("✅ API key works:", data);
  } catch (err) {
    console.error("❌ API key failed:", err);
  }
};

testKey();
