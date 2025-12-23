import { config } from "dotenv";

config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};

export default env;
