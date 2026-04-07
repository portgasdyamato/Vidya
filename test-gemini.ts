import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from "@google/genai";

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: "say hi",
    });
    console.log("SUCCESS:", response.text);
  } catch (e: any) {
    console.log("FAIL:", e.message);
  }
}
test();
