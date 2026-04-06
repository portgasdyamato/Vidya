import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
async function run() {
  const googleAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await googleAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    console.log("flash success:", !!response);
  } catch (e) {
    console.error("flash failed:", e.message);
  }
  try {
    const response = await googleAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    console.log("2.0-flash success:", !!response);
  } catch (e) {
    console.error("2.0-flash failed:", e.message);
  }
}
run();
