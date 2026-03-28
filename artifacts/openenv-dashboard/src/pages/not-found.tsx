import React from "react";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border border-destructive/20 shadow-lg shadow-destructive/20">
        <AlertTriangle className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-5xl font-display font-bold mb-4 tracking-tight">404</h1>
      <h2 className="text-2xl font-semibold mb-6 text-foreground">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">
        The route you are looking for does not exist in the dashboard.
      </p>
      <Link href="/">
        <Button size="lg" className="px-8 shadow-lg">Return to Dashboard</Button>
      </Link>
    </div>
  );
}
