import OpenAI from "openai";
import env from "./env.js";

let client = null;

if (env.openaiApiKey) {
  client = new OpenAI({ apiKey: env.openaiApiKey });
}

export const hasOpenAIClient = () => Boolean(client);

export const getOpenAIClient = () => {
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return client;
};
