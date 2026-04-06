import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  resetWorkspace,
  stepWorkspace,
  getWorkspaceState,
  listWorkspaceTasks,
  getWorkspaceSessions,
} from "@workspace/api-client-react";

// Base URL for direct API calls (new endpoints not yet in generated client)
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useWorkspaceState() {
  return useQuery({
    queryKey: ["workspace", "state"],
    queryFn: () => getWorkspaceState(),
    refetchInterval: 2000,
  });
}

export function useWorkspaceTasks() {
  return useQuery({
    queryKey: ["workspace", "tasks"],
    queryFn: () => listWorkspaceTasks(),
  });
}

export function useWorkspaceSessions() {
  return useQuery({
    queryKey: ["workspace", "sessions"],
    queryFn: () => getWorkspaceSessions(),
  });
}

export function useWorkspaceReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { taskId?: string }) => resetWorkspace({ taskId: vars.taskId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

export function useWorkspaceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { action: string; params?: Record<string, unknown> }) =>
      stepWorkspace({ action: vars.action, params: vars.params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", "state"] });
      qc.invalidateQueries({ queryKey: ["workspace", "sessions"] });
    },
  });
}

/** Feature 4 — Performance Metrics */
export function useWorkspaceMetrics() {
  return useQuery({
    queryKey: ["workspace", "metrics"],
    queryFn: () => fetch(`${BASE}/api/workspace/metrics`).then(r => r.json()),
    refetchInterval: 10000,
  });
}

/** Feature 5 — Leaderboard */
export function useWorkspaceLeaderboard() {
  return useQuery({
    queryKey: ["workspace", "leaderboard"],
    queryFn: () => fetch(`${BASE}/api/workspace/leaderboard`).then(r => r.json()),
    refetchInterval: 10000,
  });
}

/** Feature 6 — Episode Replay */
export function useWorkspaceReplay() {
  return useQuery({
    queryKey: ["workspace", "episode_replay"],
    queryFn: () => fetch(`${BASE}/api/workspace/episode_replay`).then(r => r.json()),
    refetchInterval: 3000,
  });
}
