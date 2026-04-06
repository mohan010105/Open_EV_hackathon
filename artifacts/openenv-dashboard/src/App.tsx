import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Layout & Pages
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Simulation from "@/pages/Simulation";
import Tasks from "@/pages/Tasks";
import History from "@/pages/History";
import WorkspaceRunner from "@/pages/WorkspaceRunner";
import WorkspaceTasks from "@/pages/WorkspaceTasks";
import WorkspaceAnalytics from "@/pages/WorkspaceAnalytics";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/simulation" component={Simulation} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/history" component={History} />
        <Route path="/workspace" component={WorkspaceRunner} />
        <Route path="/workspace/tasks" component={WorkspaceTasks} />
        <Route path="/workspace/analytics" component={WorkspaceAnalytics} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
