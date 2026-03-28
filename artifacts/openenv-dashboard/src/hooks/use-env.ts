import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEnvironmentState,
  useListTasks,
  useGetSessions,
  useStepEnvironment,
  useResetEnvironment,
  getGetEnvironmentStateQueryKey,
  getListTasksQueryKey,
  getGetSessionsQueryKey
} from "@workspace/api-client-react";

export function useEnvState() {
  return useGetEnvironmentState({
    query: {
      refetchInterval: 5000, // Periodically check state in case of external changes
    }
  });
}

export function useTasks() {
  return useListTasks();
}

export function useSessions() {
  return useGetSessions();
}

export function useEnvStep() {
  const queryClient = useQueryClient();
  
  return useStepEnvironment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEnvironmentStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      }
    }
  });
}

export function useEnvReset() {
  const queryClient = useQueryClient();
  
  return useResetEnvironment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEnvironmentStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      }
    }
  });
}
