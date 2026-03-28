import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  resetWorkspace,
  stepWorkspace,
  getWorkspaceState,
  listWorkspaceTasks,
  getWorkspaceSessions,
} from "@workspace/api-client-react";

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
