/**
 * Workspace Assistant environment routes.
 * POST /workspace/reset   → reset()
 * POST /workspace/step    → step(action)
 * GET  /workspace/state   → state()
 * GET  /workspace/tasks   → list tasks
 * GET  /workspace/sessions → history
 */

import { Router, type IRouter } from "express";
import {
  ResetWorkspaceBody,
  StepWorkspaceBody,
} from "@workspace/api-zod";
import { workspaceEnv } from "../env/workspace/environment.js";

const router: IRouter = Router();

router.post("/workspace/reset", (req, res) => {
  const parsed = ResetWorkspaceBody.safeParse(req.body ?? {});
  const taskId = parsed.success ? parsed.data.taskId : undefined;
  const seed = parsed.success ? parsed.data.seed : undefined;
  res.json(workspaceEnv.reset(taskId, seed));
});

router.post("/workspace/step", (req, res) => {
  const parsed = StepWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const { action, params } = parsed.data;
  res.json(workspaceEnv.step(action, (params as Record<string, unknown>) ?? {}));
});

router.get("/workspace/state", (_req, res) => {
  res.json(workspaceEnv.getState());
});

router.get("/workspace/tasks", (_req, res) => {
  res.json({ tasks: workspaceEnv.getTasks() });
});

router.get("/workspace/sessions", (_req, res) => {
  res.json(workspaceEnv.getSessions());
});

export default router;
