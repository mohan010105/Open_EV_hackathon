/**
 * OpenEnv environment routes — exposes the RL interface over HTTP.
 * POST /api/env/reset    → reset()
 * POST /api/env/step     → step(action)
 * GET  /api/env/state    → state()
 * GET  /api/env/tasks    → list tasks
 * GET  /api/env/sessions → session history
 */

import { Router, type IRouter } from "express";
import {
  ResetEnvironmentBody,
  StepEnvironmentBody,
} from "@workspace/api-zod";
import { env } from "../env/environment.js";
import { TASKS } from "../env/tasks.js";

const router: IRouter = Router();

/** POST /env/reset */
router.post("/env/reset", (req, res) => {
  const parsed = ResetEnvironmentBody.safeParse(req.body ?? {});
  const taskId = parsed.success ? parsed.data.taskId : undefined;
  const seed = parsed.success ? parsed.data.seed : undefined;

  const result = env.reset(taskId, seed);
  res.json(result);
});

/** POST /env/step */
router.post("/env/step", (req, res) => {
  const parsed = StepEnvironmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: parsed.error.message,
    });
    return;
  }

  const { action, params } = parsed.data;
  const result = env.step(action, (params as Record<string, unknown>) ?? {});
  res.json(result);
});

/** GET /env/state */
router.get("/env/state", (_req, res) => {
  const state = env.getState();
  res.json(state);
});

/** GET /env/tasks */
router.get("/env/tasks", (_req, res) => {
  res.json({ tasks: TASKS });
});

/** GET /env/sessions */
router.get("/env/sessions", (_req, res) => {
  const sessions = env.getSessions();
  res.json(sessions);
});

export default router;
