import express from "express";
import cors from "cors";
import morgan from "morgan";
import env from "./config/env.js";
import agentRouter from "./routes/agent.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/agent", agentRouter);

app.use((err, req, res, next) => {
  console.error("api_error", err);
  const status = err.status || 400;
  res.status(status).json({
    message: err.message || "Unexpected server error",
    details: err?.issues || undefined,
  });
});

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
