"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const t = (localStorage.getItem("ld-theme") as "light" | "dark" | null) ?? "light";
      setTheme(t);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("ld-theme", theme);
    } catch {}
  }, [theme]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="hidden md:flex md:w-[252px] shrink-0 border-r border-border bg-zinc-50 dark:bg-[#0a0a0a] flex-col overflow-y-auto">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 sm:px-8 sm:py-7 max-w-[1480px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function TopBar({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 h-14 px-5 sm:px-8 border-b border-border bg-background">
      <button
        type="button"
        onClick={onToggleTheme}
        title="Toggle theme"
        className="h-9 w-9 rounded-md border border-border bg-background text-foreground inline-flex items-center justify-center shadow-xs hover:bg-accent cursor-pointer"
      >
        {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
      </button>
      <button
        type="button"
        title="Profile"
        className="h-9 w-9 rounded-full overflow-hidden border border-border bg-gradient-to-br from-zinc-300 to-zinc-200 dark:from-zinc-700 dark:to-zinc-800 inline-flex items-center justify-center cursor-pointer"
      >
        <Avatar />
      </button>
    </div>
  );
}

function Avatar() {
  return (
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden>
      <defs>
        <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3f3f46" />
          <stop offset="1" stopColor="#18181b" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" fill="url(#bg)" />
      <circle cx="18" cy="14.5" r="5.5" fill="#e4e4e7" />
      <path
        d="M6 32 C8 24 14 22 18 22 C22 22 28 24 30 32 Z"
        fill="#e4e4e7"
      />
    </svg>
  );
}
