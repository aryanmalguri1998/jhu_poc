import { Router } from "express";
import { runAgent } from "../services/agentService.js";
import { runExperiment } from "../services/experimentService.js";
import {
  reconcile,
  sendOutcomePrompt,
} from "../services/reconciliationService.js";

const router = Router();

router.post("/run", async (req, res, next) => {
  try {
    const result = await runAgent(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/experiment", async (req, res, next) => {
  try {
    const result = await runExperiment(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/reconcile", async (req, res, next) => {
  try {
    const result = await reconcile(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/outcome", async (req, res, next) => {
  try {
    const result = await sendOutcomePrompt(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
