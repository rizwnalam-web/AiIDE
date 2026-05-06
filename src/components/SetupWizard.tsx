import React, { useState } from "react";
import {
  Monitor, Smartphone, Globe, Server, Package, Tv2, Apple, Layers,
  ChevronRight, ChevronDown, Play, CheckSquare, Square, ExternalLink,
  Terminal, Check, RefreshCw
} from "lucide-react";
import { cn } from "../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupStep {
  label: string;
  command: string;
  description?: string;
}

interface SetupTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;          // tailwind text colour class
  bgColor: string;        // tailwind bg colour class
  category: string;
  steps: SetupStep[];
  docs?: string;
}

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: SetupTemplate[] = [
  // ── Windows ──────────────────────────────────────────────────────────────
  {
    id: "win-electron",
    name: "Windows Desktop (Electron)",
    description: "Cross-platform desktop app with Electron + React",
    icon: Monitor,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    category: "Windows",
    docs: "https://www.electronjs.org/docs/latest",
    steps: [
      { label: "Scaffold Vite + React", command: "npm create vite@latest my-app -- --template react-ts", description: "Creates the React frontend" },
      { label: "Install Electron", command: "npm install --save-dev electron electron-builder concurrently wait-on", description: "Adds Electron dev dependencies" },
      { label: "Install dependencies", command: "npm install", description: "Installs all packages" },
      { label: "Run in dev mode", command: "npm run dev", description: "Starts Vite + Electron concurrently" },
    ],
  },
  {
    id: "win-wpf",
    name: "Windows WPF / WinForms (.NET)",
    description: "Native Windows UI app using .NET 8",
    icon: Monitor,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    category: "Windows",
    docs: "https://learn.microsoft.com/en-us/dotnet/desktop/wpf/",
    steps: [
      { label: "Check .NET version", command: "dotnet --version" },
      { label: "Create WPF project", command: "dotnet new wpf -n MyApp -o ./my-wpf-app" },
      { label: "Restore packages", command: "dotnet restore ./my-wpf-app" },
      { label: "Build project", command: "dotnet build ./my-wpf-app" },
      { label: "Run application", command: "dotnet run --project ./my-wpf-app" },
    ],
  },
  {
    id: "win-tauri",
    name: "Windows Desktop (Tauri)",
    description: "Lightweight native desktop app with Rust + Web frontend",
    icon: Monitor,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    category: "Windows",
    docs: "https://tauri.app/start/",
    steps: [
      { label: "Install Rust", command: "winget install -e --id Rustlang.Rust.MSVC" },
      { label: "Install Tauri CLI", command: "npm install --save-dev @tauri-apps/cli" },
      { label: "Scaffold Tauri app", command: "npm create tauri-app@latest" },
      { label: "Install dependencies", command: "npm install" },
      { label: "Run in dev mode", command: "npm run tauri dev" },
    ],
  },
  // ── Android ──────────────────────────────────────────────────────────────
  {
    id: "android-rn",
    name: "Android (React Native)",
    description: "Cross-platform mobile app targeting Android & iOS",
    icon: Smartphone,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    category: "Android",
    docs: "https://reactnative.dev/docs/environment-setup",
    steps: [
      { label: "Install React Native CLI", command: "npm install -g react-native-cli" },
      { label: "Create project", command: "npx react-native init MyApp --template react-native-template-typescript" },
      { label: "Install dependencies", command: "cd MyApp && npm install" },
      { label: "Start Metro bundler", command: "cd MyApp && npx react-native start" },
      { label: "Run on Android", command: "cd MyApp && npx react-native run-android", description: "Requires Android Studio & emulator running" },
    ],
  },
  {
    id: "android-expo",
    name: "Android / iOS (Expo)",
    description: "Managed React Native with Expo — fastest mobile setup",
    icon: Smartphone,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    category: "Android",
    docs: "https://docs.expo.dev/",
    steps: [
      { label: "Install Expo CLI", command: "npm install -g expo-cli" },
      { label: "Create Expo app", command: "npx create-expo-app MyApp --template blank-typescript" },
      { label: "Install dependencies", command: "cd MyApp && npm install" },
      { label: "Start Expo server", command: "cd MyApp && npx expo start" },
    ],
  },
  {
    id: "android-flutter",
    name: "Android / iOS (Flutter)",
    description: "Google's UI toolkit for cross-platform native apps",
    icon: Smartphone,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    category: "Android",
    docs: "https://flutter.dev/docs/get-started",
    steps: [
      { label: "Check Flutter install", command: "flutter doctor" },
      { label: "Create Flutter project", command: "flutter create my_app" },
      { label: "Get packages", command: "cd my_app && flutter pub get" },
      { label: "Run on device/emulator", command: "cd my_app && flutter run" },
    ],
  },
  // ── Web ──────────────────────────────────────────────────────────────────
  {
    id: "web-next",
    name: "Web App (Next.js)",
    description: "Full-stack React framework with SSR and API routes",
    icon: Globe,
    color: "text-white",
    bgColor: "bg-white/5",
    category: "Web",
    docs: "https://nextjs.org/docs",
    steps: [
      { label: "Create Next.js app", command: "npx create-next-app@latest my-app --typescript --tailwind --eslint --app" },
      { label: "Install dependencies", command: "cd my-app && npm install" },
      { label: "Start dev server", command: "cd my-app && npm run dev" },
    ],
  },
  {
    id: "web-vite",
    name: "Web App (Vite + React)",
    description: "Lightning-fast SPA with Vite, React and TypeScript",
    icon: Globe,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    category: "Web",
    docs: "https://vite.dev",
    steps: [
      { label: "Scaffold project", command: "npm create vite@latest my-app -- --template react-ts" },
      { label: "Install dependencies", command: "cd my-app && npm install" },
      { label: "Start dev server", command: "cd my-app && npm run dev" },
    ],
  },
  // ── Backend / API ─────────────────────────────────────────────────────────
  {
    id: "api-express",
    name: "REST API (Node + Express)",
    description: "Node.js REST API with TypeScript and Express",
    icon: Server,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    category: "Backend",
    steps: [
      { label: "Init project", command: "mkdir my-api && cd my-api && npm init -y" },
      { label: "Install Express + TypeScript", command: "cd my-api && npm install express && npm install --save-dev typescript ts-node @types/express @types/node nodemon" },
      { label: "Init TypeScript config", command: "cd my-api && npx tsc --init" },
      { label: "Start dev server", command: "cd my-api && npx nodemon --exec ts-node src/index.ts" },
    ],
  },
  {
    id: "api-fastapi",
    name: "REST API (FastAPI / Python)",
    description: "High-performance async Python API with FastAPI",
    icon: Server,
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    category: "Backend",
    docs: "https://fastapi.tiangolo.com",
    steps: [
      { label: "Create virtual environment", command: "python -m venv .venv" },
      { label: "Activate venv (Windows)", command: ".venv\\Scripts\\activate" },
      { label: "Install FastAPI + Uvicorn", command: "pip install fastapi uvicorn[standard]" },
      { label: "Run dev server", command: "uvicorn main:app --reload" },
    ],
  },
  // ── macOS / iOS ──────────────────────────────────────────────────────────
  {
    id: "ios-swift",
    name: "macOS / iOS (Swift / Xcode)",
    description: "Native Apple platform app using Swift",
    icon: Apple,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    category: "macOS / iOS",
    docs: "https://developer.apple.com/swift/",
    steps: [
      { label: "Check Xcode CLI tools", command: "xcode-select --version" },
      { label: "Install Xcode CLI tools", command: "xcode-select --install" },
      { label: "Check Swift version", command: "swift --version" },
      { label: "Create Swift package", command: "mkdir MyApp && cd MyApp && swift package init --type executable" },
      { label: "Build project", command: "cd MyApp && swift build" },
    ],
  },
  // ── TV / Smart Displays ───────────────────────────────────────────────────
  {
    id: "tv-roku",
    name: "TV App (Roku / BrightScript)",
    description: "Streaming channel for Roku devices",
    icon: Tv2,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    category: "TV / Streaming",
    docs: "https://developer.roku.com/en-gb/docs/developer-program/getting-started/sdk-development-guide.md",
    steps: [
      { label: "Install Roku CLI", command: "npm install -g @rokucommunity/brightscript-language" },
      { label: "Clone Roku template", command: "git clone https://github.com/rokudev/scenegraph-master-sample" },
      { label: "Package channel", command: "cd scenegraph-master-sample && zip -r channel.zip ." },
    ],
  },
  // ── Package / CLI ─────────────────────────────────────────────────────────
  {
    id: "pkg-npm",
    name: "npm Package / CLI Tool",
    description: "Publishable Node.js package or CLI utility",
    icon: Package,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    category: "Package / CLI",
    steps: [
      { label: "Init package", command: "mkdir my-pkg && cd my-pkg && npm init -y" },
      { label: "Install TypeScript", command: "cd my-pkg && npm install --save-dev typescript tsup rimraf" },
      { label: "Init TypeScript config", command: "cd my-pkg && npx tsc --init" },
      { label: "Build package", command: "cd my-pkg && npx tsup src/index.ts --format cjs,esm --dts" },
      { label: "Publish (dry-run)", command: "cd my-pkg && npm publish --dry-run" },
    ],
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onRunCommand: (cmd: string) => void;
}

export function SetupWizard({ onRunCommand }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ran, setRan] = useState<Set<string>>(new Set());

  const filtered = TEMPLATES.filter(
    t => selectedCategory === "All" || t.category === selectedCategory
  );

  const handleRun = (templateId: string, stepIdx: number, cmd: string) => {
    onRunCommand(cmd);
    setRan(prev => new Set(prev).add(`${templateId}-${stepIdx}`));
  };

  const runAll = (t: SetupTemplate) => {
    t.steps.forEach((s, i) => {
      setTimeout(() => handleRun(t.id, i, s.command), i * 400);
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
        <Layers size={14} className="text-agent-teal shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Setup & Scaffold</span>
      </div>

      {/* Category filter */}
      <div className="px-2 py-2 flex flex-wrap gap-1 border-b border-white/5 shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-all",
              selectedCategory === cat
                ? "bg-agent-teal text-[#090909]"
                : "bg-white/5 text-[#858585] hover:bg-white/10 hover:text-white"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
        {filtered.map(t => {
          const Icon = t.icon;
          const isOpen = expanded === t.id;
          const allRan = t.steps.every((_, i) => ran.has(`${t.id}-${i}`));

          return (
            <div
              key={t.id}
              className={cn(
                "rounded-md border transition-all",
                isOpen ? "border-white/15 bg-[#1a1a2e]" : "border-white/8 bg-[#161616] hover:border-white/15"
              )}
            >
              {/* Template header row */}
              <div
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none"
                onClick={() => setExpanded(isOpen ? null : t.id)}
              >
                <div className={cn("p-1 rounded shrink-0", t.bgColor)}>
                  <Icon size={12} className={t.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[#cccccc] truncate">{t.name}</div>
                  <div className="text-[9px] text-[#555] truncate">{t.description}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {allRan && <Check size={10} className="text-green-400" />}
                  {isOpen ? <ChevronDown size={12} className="text-[#555]" /> : <ChevronRight size={12} className="text-[#555]" />}
                </div>
              </div>

              {/* Expanded steps */}
              {isOpen && (
                <div className="border-t border-white/5 px-2.5 py-2 space-y-1.5">
                  {/* Run all + docs links */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => runAll(t)}
                      className="flex items-center gap-1.5 text-[9px] px-2.5 py-1 rounded bg-agent-teal/20 text-agent-teal hover:bg-agent-teal/30 font-bold uppercase tracking-wider transition-colors"
                    >
                      <Play size={9} /> Run All Steps
                    </button>
                    {t.docs && (
                      <a
                        href={t.docs}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[9px] text-[#555] hover:text-vscode-blue transition-colors"
                      >
                        <ExternalLink size={9} /> Docs
                      </a>
                    )}
                  </div>

                  {/* Individual steps */}
                  {t.steps.map((step, i) => {
                    const done = ran.has(`${t.id}-${i}`);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded border px-2.5 py-2 transition-all",
                          done ? "border-green-500/20 bg-green-500/5" : "border-white/5 bg-black/20"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              "text-[8px] font-extrabold shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                              done ? "bg-green-500/20 text-green-400" : "bg-white/5 text-[#555]"
                            )}>
                              {done ? <Check size={8} /> : i + 1}
                            </span>
                            <span className="text-[10px] font-semibold text-[#cccccc] truncate">{step.label}</span>
                          </div>
                          <button
                            onClick={() => handleRun(t.id, i, step.command)}
                            className="shrink-0 flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-vscode-blue/20 text-vscode-blue hover:bg-vscode-blue/40 font-bold uppercase transition-colors"
                            title="Run in terminal"
                          >
                            <Terminal size={8} /> Run
                          </button>
                        </div>
                        <code className="block text-[9px] font-mono text-[#858585] bg-black/30 rounded px-2 py-1 truncate" title={step.command}>
                          {step.command}
                        </code>
                        {step.description && (
                          <div className="text-[8px] text-[#444] mt-1 italic">{step.description}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
