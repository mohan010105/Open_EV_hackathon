/**
 * Workspace Assistant environment routes.
 *
 * POST /workspace/reset          → reset episode (supports difficulty, mode, agent_name)
 * POST /workspace/step           → execute action
 * GET  /workspace/state          → current observation + session meta
 * GET  /workspace/tasks          → list available tasks
 * GET  /workspace/sessions       → session history
 * GET  /workspace/episode_replay → current episode step log (Feature 6)
 * GET  /workspace/metrics        → aggregated performance metrics (Feature 4)
 * GET  /workspace/leaderboard    → ranked agent scores (Feature 5)
 */

import { Router, type IRouter } from "express";
import { StepWorkspaceBody } from "@workspace/api-zod";
import { workspaceEnv } from "../env/workspace/environment.js";
import type { Difficulty, Mode } from "../env/workspace/environment.js";

const router: IRouter = Router();

const DIFFICULTIES = new Set<Difficulty>(["easy", "medium", "hard"]);
const MODES        = new Set<Mode>(["training", "evaluation"]);

function parseDifficulty(v: unknown): Difficulty | undefined {
  return DIFFICULTIES.has(v as Difficulty) ? (v as Difficulty) : undefined;
}
function parseMode(v: unknown): Mode | undefined {
  return MODES.has(v as Mode) ? (v as Mode) : undefined;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.post("/workspace/reset", (req, res) => {
  const body       = (req.body ?? {}) as Record<string, unknown>;
  const taskId     = typeof body.task_id   === "string" ? body.task_id   :
                     typeof body.taskId    === "string" ? body.taskId    : undefined;
  const seed       = typeof body.seed      === "number" ? body.seed      : undefined;
  const difficulty = parseDifficulty(body.difficulty);
  const mode       = parseMode(body.mode);
  const agentName  = typeof body.agent_name === "string" ? body.agent_name : undefined;

  res.json(workspaceEnv.reset(taskId, seed, difficulty, mode, agentName));
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

/** Feature 6 — Episode Replay */
router.get("/workspace/episode_replay", (_req, res) => {
  res.json(workspaceEnv.getEpisodeReplay());
});

/** Feature 4 — Performance Metrics */
router.get("/workspace/metrics", (_req, res) => {
  res.json(workspaceEnv.getMetrics());
});

/** Feature 5 — Leaderboard */
router.get("/workspace/leaderboard", (_req, res) => {
  res.json(workspaceEnv.getLeaderboard());
});

export default router;
