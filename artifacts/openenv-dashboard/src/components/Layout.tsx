import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlayCircle, ListTodo, History, TerminalSquare, Box } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/simulation", label: "Runner", icon: PlayCircle },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/history", label: "History", icon: History },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/bg-mesh.png`} 
          alt="Background" 
          className="w-full h-full object-cover opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/95 to-background z-10" />
      </div>

      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 glass-panel z-20 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Box className="w-6 h-6 text-primary mr-3" />
          <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            OpenEnv
          </span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          <div className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Environment
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
              )}>
                <item.icon className={cn("w-5 h-5 mr-3 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm">
            <TerminalSquare className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-muted-foreground font-mono text-xs">v0.1.0-alpha</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col z-10 min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 md:hidden border-b border-border/50 glass-panel flex items-center px-4">
          <Box className="w-6 h-6 text-primary mr-3" />
          <span className="font-display font-bold text-lg">OpenEnv</span>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
