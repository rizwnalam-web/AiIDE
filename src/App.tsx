import React, { useState, useEffect, useRef } from "react";
import { 
  FileCode, 
  Search, 
  MessageSquare, 
  Database, 
  Settings, 
  Terminal as TerminalIcon,
  ChevronRight,
  ChevronDown,
  Play,
  Save,
  Menu,
  X,
  Terminal,
  Plus,
  Code2,
  Cpu,
  BrainCog,
  Users,
  Library,
  Mic,
  MicOff,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Upload,
  History,
  ArrowLeft,
  Building2
} from "lucide-react";
import { MemoryPalace } from "./components/MemoryPalace";
import { motion, AnimatePresence } from "motion/react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/src/lib/utils";
import { 
  FileNode, 
  ChatMessage, 
  ViewType, 
  DBConnection, 
  PanelTab, 
  TriggerConfig, 
  CollaborationSession, 
  KnowledgeDocument,
  AgentAction,
  RefactoringProposal,
  TimelineEvent
} from "@/src/types";
import { 
  chatStream, 
  getCodeCompletion, 
  generatePLSQL, 
  transformSQL 
} from "@/src/services/geminiService";
import { useAgentMode } from "./services/AgentModeProvider";

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>("files");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(["Welcome to Nexus AI Editor Terminal.", "Ready..."]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState<"general" | "sql">("general");
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>("terminal");
  const [plsqlDocs, setPlsqlDocs] = useState<string>("");
  const [reviewResults, setReviewResults] = useState<string>("");
  const [testGenResults, setTestGenResults] = useState<string>("");
  const [profilerResults, setProfilerResults] = useState<string>("");
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({
    table: "",
    timing: "BEFORE",
    event: "INSERT",
    action: ""
  });
  const [dbConnections, setDbConnections] = useState<DBConnection[]>([
    { id: "1", name: "Internal PG", type: "postgresql", status: "connected" }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [collabSession, setCollabSession] = useState<CollaborationSession | null>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [proposals, setProposals] = useState<RefactoringProposal[]>([]);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionStatus, setEvolutionStatus] = useState<"idle" | "analyzing" | "improving">("idle");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const addTimelineEvent = (type: TimelineEvent["type"], description: string, metadata: TimelineEvent["metadata"] = {}) => {
    const newEvent: TimelineEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      description,
      metadata
    };
    setTimeline(prev => [newEvent, ...prev]);
  };

  useEffect(() => {
    let recognition: any = null;
    if (isRecording && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setVoiceTranscript(transcript);
        setUserInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setTerminalOutput(prev => [...prev, "⚠ Microphone access denied. Please click the lock icon in your browser's address bar to allow microphone access for this site."]);
        } else {
          setTerminalOutput(prev => [...prev, `⚠ Speech recognition error: ${event.error}`]);
        }
      };

      recognition.start();
    }

    return () => {
      if (recognition) recognition.stop();
    };
  }, [isRecording]);

  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCompletionTime = useRef<number>(0);

  useEffect(() => {
    addTimelineEvent("session_start", "Nexus IDE Session Started");
    fetchFileTree();
  }, []);

  const handleEditorWillMount = (monaco: any) => {
    // Register inline completion provider
    monaco.languages.registerInlineCompletionsProvider({ pattern: "**" }, {
      provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
        // Debounce logic
        if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
        
        // Throttling: if we requested too recently, skip
        const now = Date.now();
        if (now - lastCompletionTime.current < 100) return { items: [] };

        return new Promise((resolve) => {
          completionTimeoutRef.current = setTimeout(async () => {
            lastCompletionTime.current = Date.now();
            
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 50),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });

            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
              endColumn: 1
            });

            try {
              const completion = await getCodeCompletion(prefix, suffix, model.uri.fsPath);
              if (token.isCancellationRequested) return resolve({ items: [] });
              
              resolve({
                items: [{
                  insertText: completion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                  }
                }]
              });
            } catch (err) {
              resolve({ items: [] });
            }
          }, 150); // 150ms debounce
        });
      },
      freeInlineCompletions: () => {}
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
  };

  const fetchFileTree = async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      setFileTree(data);
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  const handleAgentTrigger = async (agentType: "review" | "test" | "profile" | "refactor") => {
    if (!activeFile) {
       setTerminalOutput(prev => [...prev, "⚠ Please open a file first."]);
       return;
    }

    setIsTyping(true);
    setTerminalOutput(prev => [...prev, `AI Agent: Starting ${agentType} for ${activeFile}...`]);
    
    try {
       const result = await transformSQL(fileContent, agentType); 
       
       if (agentType === "review") setReviewResults(result);
       else if (agentType === "test") setTestGenResults(result);
       else if (agentType === "profile") setProfilerResults(result);
       else if (agentType === "refactor") {
         const newProposal: RefactoringProposal = {
           id: Math.random().toString(36).substr(2, 9),
           title: "Autonomous Optimization",
           description: "Refactored code for better maintainability and performance based on structural analysis.",
           impact: "high",
           filePath: activeFile,
           diff: result,
           status: "pending"
         };
         setProposals(prev => [newProposal, ...prev]);
       }

       setChatMessages(prev => [...prev, 
        { role: "user", content: `Run ${agentType} on ${activeFile}` },
        { 
          role: "assistant", 
          content: agentType === "refactor" ? `I've generated an Evolution Proposal for ${activeFile}. Review it in the Nexus Prime tab.` : `I've analyzed ${activeFile}. Here is the ${agentType} report:`,
          actions: [{
            id: Math.random().toString(36).substr(2, 9),
            type: "think",
            description: `Analyzing ${activeFile} for ${agentType}`,
            status: "completed",
            result: result
          }]
        }
      ]);

      if (agentType === "review") setActivePanelTab("review_results");
      else if (agentType === "test") setActivePanelTab("test_gen");
      else if (agentType === "profile") setActivePanelTab("profiler");
      else if (agentType === "refactor") setActiveView("agents");
      
      setTerminalOutput(prev => [...prev, `✓ ${agentType} completed. See results in the panel.`]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, "Error: " + (err as Error).message]);
    } finally {
      setIsTyping(false);
    }
  };

  const applyProposal = async (proposal: RefactoringProposal) => {
    try {
      setEvolutionStatus("improving");
      setTerminalOutput(prev => [...prev, `Nexus Prime: Applying evolution to ${proposal.filePath}...`]);
      
      const res = await fetch("/api/write-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: proposal.filePath, content: proposal.diff })
      });

      if (!res.ok) throw new Error("Failed to apply refactoring");

      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: "applied" } : p));
      setFileContent(proposal.diff);
      setTerminalOutput(prev => [...prev, `✓ ${proposal.filePath} evolved successfully.`]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, `Error applying evolution: ${(err as Error).message}`]);
    } finally {
      setEvolutionStatus("idle");
    }
  };

  const restoreSnapshot = (event: TimelineEvent) => {
    if (event.type === "file_change" || (event.type === "ai_action" && event.metadata.path)) {
       if (event.metadata.path && event.metadata.content !== undefined) {
          setTerminalOutput(prev => [...prev, `Time-Travel: Restoring snapshot of ${event.metadata.path}...`]);
          // For simplicity, just update active file content if it's the right one
          // In a complex app, we'd find if it's open, or open it first.
          setActiveFile(event.metadata.path);
          setFileContent(event.metadata.content);
          setActivePanelTab("terminal");
       }
    }
  };
  const handleFileClick = async (filePath: string) => {
    if (!openFiles.includes(filePath)) {
      setOpenFiles([...openFiles, filePath]);
    }
    setActiveFile(filePath);
    try {
      const res = await fetch("/api/read-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json();
      setFileContent(data.content);
    } catch (err) {
      console.error("Failed to read file", err);
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      await fetch("/api/write-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: activeFile, content: fileContent })
      });
      setTerminalOutput(prev => [...prev, `Saved ${activeFile}`]);
      addTimelineEvent("file_change", `Saved ${activeFile}`, { path: activeFile, content: fileContent });
    } catch (err) {
      console.error("Failed to save file", err);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const newMessage: ChatMessage = { role: "user", content: userInput };
    executeChat(newMessage);
  };

  const handlePLSQLQuickAction = async (type: "explain" | "convert" | "document" | "procedure" | "trigger" | "package") => {
    const selection = editorRef.current?.getSelection();
    const selectedCode = editorRef.current?.getModel()?.getValueInRange(selection) || "";
    
    if (["explain", "convert", "document"].includes(type)) {
      if (!selectedCode) {
        setTerminalOutput(prev => [...prev, "⚠ Please select some code in the editor first."]);
        return;
      }
      
      setIsTyping(true);
      try {
        const result = await transformSQL(selectedCode, type as any);
        if (type === "document") {
          setPlsqlDocs(result);
          setActivePanelTab("plsql_docs");
          setTerminalOutput(prev => [...prev, "✓ Documentation generated in PL/SQL tab."]);
        } else if (type === "convert") {
           setChatMessages(prev => [...prev, 
            { role: "user", content: `Convert this code to T-SQL: \n\n\`\`\`sql\n${selectedCode}\n\`\`\`` },
            { role: "assistant", content: result, actions: [{
              id: Math.random().toString(36).substr(2, 9),
              type: "insert_code",
              description: "Insert Converted T-SQL",
              content: result,
              status: "pending"
            }] }
          ]);
        } else {
          setChatMessages(prev => [...prev, 
            { role: "user", content: `Explain this code: \n\n\`\`\`sql\n${selectedCode}\n\`\`\`` },
            { role: "assistant", content: result }
          ]);
        }
      } catch (err) {
        setTerminalOutput(prev => [...prev, "Error: " + (err as Error).message]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (type === "trigger") {
      setShowTriggerDialog(true);
      return;
    }

    // For Procedure and Package, ask for description
    const description = window.prompt(`Describe the ${type} you need:`);
    if (!description) return;

    setIsTyping(true);
    try {
      const result = await generatePLSQL(type as any, description);
      setChatMessages(prev => [...prev, 
        { role: "user", content: `Generate ${type}: ${description}` },
        { role: "assistant", content: result, actions: [{
          id: Math.random().toString(36).substr(2, 9),
          type: "insert_code",
          description: `Insert Generated ${type}`,
          content: result,
          status: "pending"
        }] }
      ]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, "Error: " + (err as Error).message]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateTrigger = async () => {
    setShowTriggerDialog(false);
    setIsTyping(true);
    try {
      const result = await generatePLSQL("trigger", triggerConfig.action, triggerConfig);
      setChatMessages(prev => [...prev, 
        { role: "user", content: `Generate Trigger: ${triggerConfig.timing} ${triggerConfig.event} ON ${triggerConfig.table}` },
        { role: "assistant", content: result, actions: [{
          id: Math.random().toString(36).substr(2, 9),
          type: "insert_code",
          description: "Insert Generated Trigger",
          content: result,
          status: "pending"
        }] }
      ]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, "Error: " + (err as Error).message]);
    } finally {
      setIsTyping(false);
    }
  };

  const executeChat = async (newMessage: ChatMessage) => {
    setChatMessages(prev => [...prev, newMessage]);
    setUserInput("");
    setIsTyping(true);

    try {
      let assistantMsg = "";
      let assistantActions: AgentAction[] = [];
      setChatMessages(prev => [...prev, { role: "assistant", content: "", actions: [] }]);
      
      const contextPrompt = chatMode === "sql" 
        ? "You are a professional Database Administrator specialized in PL/SQL. Generate high-performance stored procedures. "
        : "You are an expert full-stack developer. Help with bugs, architectural advice, and code generation. ";
      
      const stream = chatStream([
        { role: "user", content: contextPrompt },
        ...chatMessages.map(m => ({ role: m.role, content: m.content })), 
        newMessage
      ]);

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          assistantMsg += chunk.content;
        } else if (chunk.type === 'tools') {
          const calls = chunk.content as any[];
          calls.forEach(call => {
            assistantActions.push({
              id: Math.random().toString(36).substr(2, 9),
              type: call.name,
              description: `Proposed ${call.name} ${call.args?.path || call.args?.command || ""}`,
              path: call.args?.path,
              content: call.args?.content,
              command: call.args?.command,
              status: "pending"
            });
          });
        }

        setChatMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.content = assistantMsg;
          last.actions = assistantActions;
          return newMsgs;
        });
      }
    } catch (err) {
      console.error("Stream error", err);
    } finally {
      setIsTyping(false);
    }
  };

  const { tasks, executeStep: providerExecuteStep } = useAgentMode();

  const executeAction = async (msgIndex: number, actionId: string) => {
    // Migration: Delegate to Provider if it's a task step, 
    // or keep local for simple UI actions like "insert_code"
    const msg = chatMessages[msgIndex];
    if (!msg.actions) return;
    
    const actionIndex = msg.actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;

    const action = msg.actions[actionIndex];

    // Local UI-only actions
    if (action.type === "insert_code") {
      try {
        if (editorRef.current && action.content) {
          const selection = editorRef.current.getSelection();
          const range = new monacoRef.current.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          );
          editorRef.current.executeEdits("nexus-ai", [{
            range,
            text: action.content,
            forceMoveMarkers: true
          }]);
          setChatMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[msgIndex].actions![actionIndex].status = "completed";
            newMsgs[msgIndex].actions![actionIndex].result = "Inserted code at cursor";
            return newMsgs;
          });
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // For other actions, we should ideally have them in the provider's task list.
    // In this transitional phase, we'll just show the result from the provider if we had tasks.
    // Since App.tsx currently manages its own action state, I'll enhance its error handler locally
    // to match the requested improvements.
    
    const updateActionStatus = (status: AgentAction["status"], result?: string, reasoning?: string) => {
      setChatMessages(prev => {
        const newMsgs = [...prev];
        const act = newMsgs[msgIndex].actions![actionIndex];
        act.status = status;
        if (result) act.result = result;
        if (reasoning) act.reasoning = reasoning;
        return newMsgs;
      });
    };

    updateActionStatus("running");

    const attemptExecution = async (retryCount = 0): Promise<void> => {
      try {
        let result;
        if (action.type === "write_file" || action.type === "create_file") {
          const res = await fetch("/api/write-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: action.path, content: action.content })
          });
          result = await res.json();
          if (result.success) {
            updateActionStatus("completed", `Successfully wrote to ${action.path}`);
            addTimelineEvent("ai_action", `AI: Wrote to ${action.path}`, { path: action.path, content: action.content });
            fetchFileTree();
          } else {
             throw new Error(result.error || "Failed to write file");
          }
        } else if (action.type === "read_file") {
          const res = await fetch("/api/read-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: action.path })
          });
          result = await res.json();
          if (result.error) throw new Error(result.error);
          updateActionStatus("completed", `Read content from ${action.path}`);
        } else if (action.type === "run_command") {
          const res = await fetch("/api/terminal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: action.command })
          });
          result = await res.json();
          if (result.stderr && !result.stdout) throw new Error(result.stderr);
          updateActionStatus("completed", result.stdout || result.stderr);
          addTimelineEvent("ai_action", `AI: Ran command "${action.command}"`, { command: action.command, result: result.stdout || result.stderr });
        } else {
           // Fallback for other types
           updateActionStatus("completed", "Action finished");
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        if (retryCount < 2) {
          setTerminalOutput(prev => [...prev, `Action failed: ${errorMsg}. Retrying... (${retryCount+1}/2)`]);
          await new Promise(r => setTimeout(r, 1000));
          return attemptExecution(retryCount + 1);
        }

        // Get intelligent recovery suggestion
        const recoveryPrompt = `Action ${action.type} on ${action.path || action.command} failed: "${errorMsg}". Suggest a fix.`;
        try {
          const stream = chatStream([{ role: "user", content: recoveryPrompt }]);
          let suggestion = "";
          for await (const chunk of stream) {
            if (chunk.type === 'text') suggestion += chunk.content;
          }
          updateActionStatus("failed", `Failed after retries: ${errorMsg}`, suggestion);
        } catch (recoverErr) {
          updateActionStatus("failed", `Failed after retries: ${errorMsg}`, "Unable to get recovery suggestion.");
        }
      }
    };

    await attemptExecution();
  };

  const runCommand = async (cmd: string) => {
    setTerminalOutput(prev => [...prev, `> ${cmd}`]);
    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      if (data.stdout) setTerminalOutput(prev => [...prev, data.stdout]);
      if (data.stderr) setTerminalOutput(prev => [...prev, `Error: ${data.stderr}`]);
      addTimelineEvent("command", `Executed: ${cmd}`, { command: cmd, result: data.stdout || data.stderr });
    } catch (err) {
      setTerminalOutput(prev => [...prev, `Failed: ${err}`]);
    }
  };

  const renderFileTree = (nodes: FileNode[]) => {
    return nodes.map(node => (
      <div key={node.path} className="pl-4">
        <div 
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-[#2a2d2e] select-none text-sm group",
            activeFile === node.path && "bg-[#37373d]"
          )}
          onClick={() => node.type === "file" ? handleFileClick(node.path) : null}
        >
          {node.type === "directory" ? <ChevronDown size={14} className="text-gray-400" /> : <FileCode size={14} className="text-blue-400" />}
          <span className="text-gray-300">{node.name}</span>
        </div>
        {node.children && <div className="ml-2 border-l border-gray-700/50">{renderFileTree(node.children)}</div>}
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-screen bg-editor-bg text-[#cccccc] font-sans overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Rails (Activity Bar) */}
        <div className="w-[48px] bg-activity-bg flex flex-col items-center py-3 gap-5 border-r border-border-dark">
          <SidebarIcon icon={FileCode} active={activeView === "files"} onClick={() => setActiveView("files")} />
          <SidebarIcon icon={Search} active={activeView === "search"} onClick={() => setActiveView("search")} />
          <SidebarIcon icon={MessageSquare} active={activeView === "chat"} onClick={() => setActiveView("chat")} />
          <SidebarIcon icon={BrainCog} active={activeView === "agents"} onClick={() => setActiveView("agents")} />
          <SidebarIcon icon={Users} active={activeView === "collaboration"} onClick={() => setActiveView("collaboration")} />
          <SidebarIcon icon={Library} active={activeView === "knowledge"} onClick={() => setActiveView("knowledge")} />
          <SidebarIcon icon={History} active={activeView === "timeline"} onClick={() => setActiveView("timeline")} />
          <SidebarIcon icon={Building2} active={activeView === "palace"} onClick={() => setActiveView("palace")} />
          <SidebarIcon icon={Database} active={activeView === "mcp"} onClick={() => setActiveView("mcp")} />
          <div className="mt-auto pb-3 flex flex-col gap-5">
            <SidebarIcon icon={Mic} active={isRecording} onClick={() => setIsRecording(!isRecording)} className={isRecording ? "text-red-500 animate-pulse" : ""} />
            <SidebarIcon icon={Settings} active={activeView === "settings"} onClick={() => setActiveView("settings")} />
          </div>
        </div>

        {/* Explorer / Active View Sidebar */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-panel-bg border-r border-border-main flex flex-col"
            >
              <div className="p-2 uppercase text-[11px] font-bold tracking-wider text-[#858585] flex justify-between items-center select-none">
                <span>{activeView}: CURSOR-REPLICATOR</span>
                <X size={14} className="cursor-pointer hover:text-white" onClick={() => setIsSidebarOpen(false)} />
              </div>
              <div className="flex-1 overflow-y-auto pt-1 custom-scrollbar">
                {activeView === "files" && renderFileTree(fileTree)}
                {activeView === "chat" && (
                  <div className="p-3 space-y-3">
                    <p className="text-[11px] text-[#858585]">Agent Mode enabled. AI can read/write files and run commands.</p>
                    <button className="w-full py-1.5 bg-vscode-blue hover:bg-[#118ad4] text-white rounded flex items-center justify-center gap-2 text-[11px] font-bold transition-colors uppercase">
                      <Cpu size={14} /> New Agent Task
                    </button>
                  </div>
                )}
                {activeView === "agents" && (
                  <div className="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
                    <div className="p-3 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Nexus Agents</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-bold">PRIME</span>
                        <div 
                          onClick={() => setIsEvolving(!isEvolving)}
                          className={cn(
                            "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
                            isEvolving ? "bg-agent-teal" : "bg-[#333]"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                            isEvolving ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                      <div className="space-y-2">
                        <div className="text-[10px] text-gray-500 font-bold uppercase px-1">Specialist Agents</div>
                        <AgentCard 
                          title="Code Reviewer" 
                          desc="Deep PR analysis & improvements" 
                          icon={FileSearch}
                          onClick={() => handleAgentTrigger("review")}
                        />
                        <AgentCard 
                          title="Test Architect" 
                          desc="Generate unit & integration tests" 
                          icon={CheckCircle2}
                          onClick={() => handleAgentTrigger("test")}
                        />
                        <AgentCard 
                          title="Performance Profiler" 
                          desc="Identify bottlenecks & optimize" 
                          icon={Zap}
                          onClick={() => handleAgentTrigger("profile")}
                        />
                        <AgentCard 
                          title="Autonomous Refactor" 
                          desc="Nexus Prime: AI-driven structural evolution" 
                          icon={Plus}
                          onClick={() => handleAgentTrigger("refactor")}
                        />
                      </div>

                      {proposals.length > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                          <div className="text-[10px] text-vscode-blue font-bold uppercase px-1 flex items-center gap-2">
                            <span>Evolution Proposals</span>
                            <span className="bg-vscode-blue/20 text-vscode-blue px-1.5 rounded-full text-[9px]">{proposals.filter(p => p.status === "pending").length}</span>
                          </div>
                          {proposals.map(proposal => (
                            <div key={proposal.id} className="p-3 bg-[#2a2d2e]/50 border border-white/5 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[120px]">{proposal.filePath.split('/').pop()}</span>
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                  proposal.impact === "high" ? "bg-red-500/10 text-red-500" : "bg-vscode-blue/10 text-vscode-blue"
                                )}>
                                  {proposal.impact} IMPACT
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{proposal.description}</p>
                              
                              {proposal.status === "pending" ? (
                                <div className="flex gap-2 pt-1">
                                  <button 
                                    onClick={() => applyProposal(proposal)}
                                    className="flex-1 py-1.5 bg-agent-teal/20 hover:bg-agent-teal/30 text-agent-teal rounded text-[9px] font-bold uppercase transition-all"
                                  >
                                    EVOLVE CODE
                                  </button>
                                  <button 
                                    onClick={() => setProposals(prev => prev.filter(p => p.id !== proposal.id))}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-all"
                                  >
                                    <MicOff size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-[9px] text-agent-teal font-bold py-1">
                                  <CheckCircle2 size={12} />
                                  <span>APPLIED</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isEvolving && evolutionStatus === "idle" && (
                        <div className="p-4 border border-agent-teal/10 bg-agent-teal/5 rounded-lg text-center space-y-2">
                          <Cpu size={24} className="mx-auto text-agent-teal animate-pulse" />
                          <p className="text-[10px] text-gray-400">Nexus Prime is monitoring your code patterns for autonomous optimization.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeView === "collaboration" && (
                  <div className="flex flex-col h-full p-4 space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Nexus Sync</h3>
                    {!collabSession ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                        <Users size={32} className="text-vscode-blue/40" />
                        <p className="text-[10px] text-gray-500">No active session found.</p>
                        <button 
                          onClick={() => setCollabSession({ id: "nexus-rd-1", host: "You", activeUsers: [], isRecording: false })}
                          className="w-full py-2 bg-vscode-blue hover:bg-vscode-blue/80 text-white rounded text-[11px] font-bold transition-all"
                        >
                          START SESSION
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                         <div className="p-3 bg-white/5 rounded border border-vscode-blue/30">
                            <div className="text-[10px] text-gray-500 mb-1 uppercase font-bold">Session ID</div>
                            <div className="text-xs font-mono text-white select-all">{collabSession.id}</div>
                         </div>
                         <div className="space-y-1">
                            <div className="text-[10px] text-gray-500 mb-2 uppercase font-bold">Participants (1)</div>
                            <div className="flex items-center gap-2 text-xs">
                               <div className="w-2 h-2 rounded-full bg-green-500" />
                               <span>You (Host)</span>
                            </div>
                         </div>
                         <button 
                           onClick={() => setCollabSession(null)}
                           className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded text-[11px] font-bold transition-all"
                         >
                           END SESSION
                         </button>
                      </div>
                    )}
                  </div>
                )}
                {activeView === "knowledge" && (
                  <div className="flex flex-col h-full p-4 space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Knowledge Base</h3>
                    <div className="border border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-all cursor-pointer">
                       <Upload size={24} className="text-gray-500" />
                       <span className="text-[10px] font-bold uppercase text-gray-500">Drop documentation</span>
                    </div>
                    <div className="space-y-2">
                       <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Documents</div>
                       <p className="text-[10px] text-gray-600 italic">No documents uploaded yet. Upload PDFs or MD files to ground the AI.</p>
                    </div>
                  </div>
                )}
                {activeView === "timeline" && (
                  <div className="flex flex-col h-full bg-[#1e1e1e]">
                    <div className="p-3 border-b border-white/5">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#858585]">Nexus Timeline</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                      {timeline.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-30">
                          <History size={32} />
                          <span className="text-[10px] mt-2 font-bold uppercase">Chronosphere Idle</span>
                        </div>
                      ) : (
                        <div className="space-y-4 relative ml-2 mt-2">
                           <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-vscode-blue/20" />
                           {timeline.map((event) => (
                             <div key={event.id} className="relative pl-6 group">
                                <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-vscode-blue border border-activity-bg group-hover:scale-150 transition-all shadow-[0_0_8px_rgba(0,122,204,0.4)]" />
                                <div className="text-[9px] text-[#555] mb-0.5 uppercase flex items-center justify-between font-bold">
                                   <span>{event.type.replace('_', ' ')}</span>
                                   <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                                <div className="text-[11px] font-bold text-[#bbbbbb] mb-1 leading-tight group-hover:text-white transition-colors">{event.description}</div>
                                {(event.type === "file_change" || (event.type === "ai_action" && event.metadata.path)) && (
                                   <button 
                                     onClick={() => restoreSnapshot(event)}
                                     className="flex items-center gap-1.5 text-[9px] text-vscode-blue font-bold tracking-widest uppercase hover:underline opacity-60 group-hover:opacity-100 transition-all"
                                   >
                                     <ArrowLeft size={10} /> TRAVEL BACK
                                   </button>
                                )}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeView === "palace" && (
                   <div className="flex flex-col h-full bg-[#0a0a0a]">
                     <MemoryPalace fileTree={fileTree} onFileSelect={(path) => {
                       handleFileClick(path);
                       setActiveView("files");
                     }} />
                   </div>
                )}
                {activeView === "mcp" && (
                  <div className="flex flex-col h-full">
                    <div className="p-3 border-b border-border-main flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase text-[#858585] tracking-tight">MCP Servers</h3>
                      <button className="p-1 hover:bg-white/5 rounded text-agent-teal transition-colors"><Plus size={14} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                      <div className="p-3 bg-[#2a2d2e] rounded border border-agent-teal/20 transition-all hover:border-agent-teal/40">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"></div>
                          <span className="text-[11px] font-bold">postgres-database</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mb-3 ml-4">
                          Protocol v0.1.0 • Connected
                        </div>
                        <div className="space-y-1 ml-4 border-l border-white/5 pl-3">
                          <div className="text-[9px] text-[#555] mb-1 font-bold uppercase tracking-widest">Capabilities</div>
                          <div className="flex items-center gap-2 text-[10px] text-white/80 py-0.5 group">
                            <Terminal size={10} className="text-agent-teal opacity-70" />
                            <span>query_database</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/80 py-0.5 group">
                            <Terminal size={10} className="text-agent-teal opacity-70" />
                            <span>list_tables</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-editor-bg">
          {/* Tabs */}
          <div className="h-[35px] bg-panel-bg flex items-center overflow-x-auto border-b border-editor-bg select-none">
            {!isSidebarOpen && (
              <button className="p-2 hover:bg-[#2d2d2d]" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={16} />
              </button>
            )}
            {openFiles.map(file => (
              <div 
                key={file}
                className={cn(
                  "px-3 h-full flex items-center gap-2 text-[12px] border-r border-editor-bg cursor-pointer min-w-[120px] max-w-[200px] bg-panel-bg hover:bg-[#2a2d2e] group transition-colors",
                  activeFile === file && "bg-editor-bg text-white border-t border-vscode-blue"
                )}
                onClick={() => handleFileClick(file)}
              >
                <FileCode size={12} className="text-vscode-blue flex-shrink-0" />
                <span className="truncate flex-1">{file.split("/").pop()}</span>
                <X size={12} className="opacity-0 group-hover:opacity-100 hover:bg-[#454545] rounded p-0.5" />
              </div>
            ))}
            <div className="flex-1" />
            <div className="flex items-center px-3 gap-3">
               <button onClick={handleSave} className="p-1 hover:bg-[#333333] rounded text-[#858585] hover:text-white transition-colors" title="Save">
                  <Save size={16} />
               </button>
               <button className="p-1 hover:bg-green-600/10 rounded text-green-500 transition-colors" title="Run Code">
                  <Play size={16} />
               </button>
            </div>
          </div>

          {/* Editor & Lower Panel */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1">
               {activeFile ? (
                 <Editor
                   height="100%"
                   theme="vs-dark"
                   path={activeFile}
                   language={activeFile.endsWith(".ts") || activeFile.endsWith(".tsx") ? "typescript" : "javascript"}
                   value={fileContent}
                   onChange={(value) => setFileContent(value || "")}
                   beforeMount={handleEditorWillMount}
                   onMount={handleEditorDidMount}
                   options={{
                     minimap: { enabled: true },
                     fontSize: 13,
                     fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
                     padding: { top: 12 },
                     scrollBeyondLastLine: false,
                     automaticLayout: true,
                     lineHeight: 20,
                     inlineSuggest: { enabled: true }
                   }}
                 />
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-[#858585] opacity-20 select-none">
                   <Code2 size={100} strokeWidth={1} />
                   <p className="mt-4 text-lg font-bold uppercase tracking-widest text-[#cccccc]">Nexus AI Editor</p>
                   <p className="mt-1 text-xs">Select a file from the explorer to begin</p>
                   <div className="mt-10 flex gap-8 text-[11px] font-mono">
                      <span className="flex items-center gap-2"><kbd>⌘</kbd> + <kbd>K</kbd> Chat</span>
                      <span className="flex items-center gap-2"><kbd>⌘</kbd> + <kbd>P</kbd> Files</span>
                      <span className="flex items-center gap-2"><kbd>⌘</kbd> + <kbd>J</kbd> Terminal</span>
                   </div>
                 </div>
               )}
            </div>

            {/* Terminal / Panel Split */}
            <div className="h-[200px] border-t border-border-main bg-editor-bg flex flex-col shadow-inner">
              <div className="flex items-center gap-5 px-4 h-[35px] bg-panel-bg text-[11px] font-bold tracking-wider text-[#858585] border-b border-editor-bg select-none">
                  <PanelTabItem label="TERMINAL" active={activePanelTab === "terminal"} onClick={() => setActivePanelTab("terminal")} />
                  <PanelTabItem label="DEBUG CONSOLE" active={activePanelTab === "debug"} onClick={() => setActivePanelTab("debug")} />
                  <PanelTabItem label="OUTPUT" active={activePanelTab === "output"} onClick={() => setActivePanelTab("output")} />
                  <PanelTabItem label="PL/SQL DOCS" active={activePanelTab === "plsql_docs"} onClick={() => setActivePanelTab("plsql_docs")} color="text-agent-teal" />
                  <PanelTabItem label="CODE REVIEW" active={activePanelTab === "review_results"} onClick={() => setActivePanelTab("review_results")} color="text-orange-400" />
                  <PanelTabItem label="TEST GEN" active={activePanelTab === "test_gen"} onClick={() => setActivePanelTab("test_gen")} color="text-green-400" />
                  <PanelTabItem label="PROFILER" active={activePanelTab === "profiler"} onClick={() => setActivePanelTab("profiler")} color="text-purple-400" />
                 <div className="ml-auto flex items-center gap-2 text-[9px] opacity-60">
                   <TerminalIcon size={12} />
                   <span className="font-mono">zsh: node</span>
                 </div>
              </div>
              <div className="flex-1 p-3 font-mono text-[12px] overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                 {activePanelTab === "terminal" && (
                   <>
                     {terminalOutput.map((line, i) => (
                       <div key={i} className="mb-0.5 leading-relaxed">{line}</div>
                     ))}
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-agent-teal">➜</span>
                        <input 
                          type="text" 
                          className="flex-1 bg-transparent border-none outline-none text-[#cccccc]" 
                          placeholder="Type a command..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              runCommand(e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                     </div>
                   </>
                 )}
                 {activePanelTab === "plsql_docs" && (
                   <div className="text-[#cccccc] text-xs leading-relaxed max-w-3xl prose prose-invert prose-sm">
                     <ReactMarkdown>{plsqlDocs || "*No documentation generated yet. Use the 'Document' tool in SQL mode.*"}</ReactMarkdown>
                   </div>
                 )}
                 {activePanelTab === "review_results" && <MarkdownOutput content={reviewResults} placeholder="No review results yet. Run 'Code Reviewer' agent." />}
                 {activePanelTab === "test_gen" && <MarkdownOutput content={testGenResults} placeholder="No tests generated yet. Run 'Test Architect' agent." />}
                 {activePanelTab === "profiler" && <MarkdownOutput content={profilerResults} placeholder="No performance analysis yet. Run 'Profiler' agent." />}
              </div>
            </div>
          </div>
        </div>

        {/* Right AI Chat Panel */}
        <div className="w-[320px] bg-panel-bg border-l border-border-main flex flex-col shadow-2xl z-10">
          <div className="p-2 px-3 flex items-center justify-between border-b border-editor-bg bg-editor-bg select-none">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-vscode-blue" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">AI Chat</span>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => setChatMode(prev => prev === "general" ? "sql" : "general")}
                 className={cn(
                   "text-[10px] px-2 py-0.5 rounded border transition-colors font-bold uppercase",
                   chatMode === "sql" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-vscode-blue/10 text-vscode-blue border-vscode-blue/20"
                 )}
               >
                 {chatMode === "sql" ? "PL/SQL" : "GPT-4O"}
               </button>
               <div className="text-[10px] bg-agent-teal text-black px-2 py-0.5 rounded font-bold uppercase cursor-pointer hover:bg-agent-teal/80">COMPOSER</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {chatMode === "sql" && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <QuickToolButton label="Explain Selection" onClick={() => handlePLSQLQuickAction("explain")} color="bg-blue-500/10 text-blue-400 border-blue-500/20" />
                <QuickToolButton label="T-SQL Convert" onClick={() => handlePLSQLQuickAction("convert")} color="bg-purple-500/10 text-purple-400 border-purple-500/20" />
                <QuickToolButton label="Package" onClick={() => handlePLSQLQuickAction("package")} color="bg-cyan-500/10 text-cyan-400 border-cyan-500/20" />
                <QuickToolButton label="New Procedure" onClick={() => handlePLSQLQuickAction("procedure")} color="bg-orange-500/10 text-orange-400 border-orange-500/20" />
                <QuickToolButton label="Trigger Setup" onClick={() => handlePLSQLQuickAction("trigger")} color="bg-pink-500/10 text-pink-400 border-pink-500/20" />
                <QuickToolButton label="Document" onClick={() => handlePLSQLQuickAction("document")} color="bg-green-500/10 text-green-400 border-green-500/20" />
              </div>
            )}
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-8">
                <Cpu size={32} className="text-agent-teal" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc]">Nexus Intelligence</p>
                  <p className="text-[10px] text-[#858585] mt-1 max-w-[180px]">Ask to refactor code, fix errors, or generate SQL.</p>
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[95%] p-3 text-[12px] rounded border leading-relaxed",
                  msg.role === "user" ? "bg-vscode-blue/10 border-vscode-blue/20 text-[#cccccc] rounded-tr-none" : "bg-editor-bg text-[#cccccc] border-border-main rounded-tl-none shadow-md"
                )}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2 border-b border-border-main/50 pb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-agent-teal animate-pulse" />
                      <span className="text-[10px] font-bold text-agent-teal uppercase tracking-widest">Nexus Response</span>
                    </div>
                  )}
                  <ReactMarkdown 
                    components={{
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter
                            {...props}
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            className="rounded border border-border-main/50 my-2 text-[11px]"
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={cn("bg-panel-bg px-1 rounded text-vscode-blue/80", className)} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Agent Actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between border-t border-border-main/30 pt-2 mb-1">
                        <div className="text-[10px] uppercase font-bold text-[#858585]">Proposed Actions</div>
                        {msg.actions.some(a => a.status === "pending") && (
                          <button 
                            onClick={() => msg.actions?.forEach(a => a.status === "pending" && executeAction(i, a.id))}
                            className="text-[9px] text-agent-teal font-bold hover:underline"
                          >
                            APPLY ALL
                          </button>
                        )}
                      </div>
                      {msg.actions.map(action => (
                        <div key={action.id} className="p-2 bg-[#2a2d2e] rounded border border-white/5 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-white/5 rounded text-agent-teal">
                                {action.type === "write_file" ? <Save size={12} /> : 
                                 action.type === "run_command" ? <TerminalIcon size={12} /> : 
                                 action.type === "query_database" || action.type === "list_tables" ? <Database size={12} /> :
                                 action.type === "insert_code" ? <Code2 size={12} /> :
                                 <FileCode size={12} />}
                              </div>
                              <span className="text-[11px] font-mono font-bold truncate max-w-[150px]">
                                {action.type === "write_file" ? `Write ${action.path}` : 
                                 action.type === "run_command" ? action.command : 
                                 action.type === "query_database" ? "Query Database" :
                                 action.type === "list_tables" ? "List Tables" :
                                 action.type === "insert_code" ? "Insert Code" :
                                 action.type === "read_file" ? `Read ${action.path}` : "Action"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {action.status === "pending" && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => executeAction(i, action.id)}
                                    className="text-[9px] bg-vscode-blue/20 text-vscode-blue border border-vscode-blue/30 px-1.5 py-0.5 rounded font-bold hover:bg-vscode-blue/30 transition-colors uppercase"
                                  >
                                    Review
                                  </button>
                                  <button 
                                    onClick={() => executeAction(i, action.id)}
                                    className="text-[9px] bg-agent-teal text-black px-1.5 py-0.5 rounded font-bold hover:bg-agent-teal/80 transition-colors uppercase"
                                  >
                                    Apply
                                  </button>
                                </div>
                              )}
                              {action.status === "running" && (
                                <div className="w-3 h-3 border-2 border-agent-teal border-t-transparent rounded-full animate-spin" />
                              )}
                              {action.status === "completed" && (
                                <div className="text-green-500 flex items-center gap-1">
                                  <Save size={10} /> <span className="text-[9px] font-bold">DONE</span>
                                </div>
                              )}
                              {action.status === "failed" && (
                                <div className="text-red-500 text-[9px] font-bold uppercase">FAILED</div>
                              )}
                            </div>
                          </div>
                          {action.type === "write_file" && action.status === "pending" && (
                            <div className="text-[10px] text-gray-400 opacity-60 truncate">
                              New content proposed for this file.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1.5 px-2">
                <div className="w-1 h-1 bg-agent-teal rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-agent-teal rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1 h-1 bg-agent-teal rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border-main bg-editor-bg">
            <div className="relative group/input">
              <textarea
                className="w-full bg-panel-bg border border-border-main rounded p-2.5 pr-10 text-[12px] outline-none focus:border-vscode-blue transition-all min-h-[70px] max-h-[180px] resize-none overflow-y-auto custom-scrollbar"
                placeholder="Ask instructions..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="absolute right-2 top-2 flex flex-col gap-2">
                 <button 
                   onClick={() => setIsRecording(!isRecording)}
                   className={cn(
                     "p-1.5 rounded transition-all",
                     isRecording ? "text-red-500 bg-red-500/10 animate-pulse" : "text-[#858585] hover:text-white hover:bg-white/5"
                   )}
                   title={isRecording ? "Stop Recording" : "Voice Input"}
                 >
                   {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                 </button>
              </div>
              <div className="absolute right-2 bottom-3 flex gap-2 opacity-40 select-none pointer-events-none">
                 <span className="text-[9px] uppercase font-bold tracking-wider">
                   Enter to Send
                 </span>
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-[9px] text-[#858585] uppercase tracking-tighter">
              <span>TAB to autocomplete</span>
              <span>⌘L to clear</span>
            </div>
          </div>
        </div>
      </div>

      {/* VS Code Style Status Bar */}
      <div className="h-[22px] bg-vscode-blue text-white flex items-center px-3 text-[11px] justify-between flex-shrink-0 select-none font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/10 px-1.5 h-full">
            <Menu size={12} />
            <span className="font-bold">Main*</span>
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/10 px-1.5 h-full">
             <Search size={10} />
             <span>UTF-8</span>
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/10 px-1.5 h-full">
             <Code2 size={12} />
             <span>TypeScript JSX</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/10 px-1.5 h-full">
             <span>Autocomp: 150ms</span>
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/10 px-1.5 h-full">
             <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_4px_white]" />
             <span className="font-bold">MCP: ONLINE</span>
          </div>
        </div>
      </div>

      {/* Trigger Dialog Simulation */}
      <AnimatePresence>
        {showTriggerDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-panel-bg border border-border-main rounded-lg shadow-2xl w-full max-w-md p-6"
            >
              <h2 className="text-sm font-bold text-white mb-6 uppercase tracking-widest border-b border-white/5 pb-2">New PL/SQL Trigger</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#858585] mb-1 block">Table Name</label>
                    <input 
                      className="w-full bg-editor-bg border border-border-main rounded p-2 text-xs outline-none focus:border-vscode-blue"
                      placeholder="e.g. EMPLOYEES"
                      value={triggerConfig.table}
                      onChange={e => setTriggerConfig({...triggerConfig, table: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#858585] mb-1 block">Timing</label>
                    <select 
                      className="w-full bg-editor-bg border border-border-main rounded p-2 text-xs outline-none focus:border-vscode-blue appearance-none"
                      value={triggerConfig.timing}
                      onChange={e => setTriggerConfig({...triggerConfig, timing: e.target.value as any})}
                    >
                      <option>BEFORE</option>
                      <option>AFTER</option>
                      <option>INSTEAD OF</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#858585] mb-1 block">Event</label>
                  <div className="flex gap-2">
                    {["INSERT", "UPDATE", "DELETE"].map(e => (
                      <button 
                        key={e}
                        onClick={() => setTriggerConfig({...triggerConfig, event: e as any})}
                        className={cn(
                          "flex-1 py-1.5 rounded border text-[10px] font-bold transition-all",
                          triggerConfig.event === e ? "bg-vscode-blue border-vscode-blue text-white" : "bg-editor-bg border-border-main text-[#858585]"
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#858585] mb-1 block">Trigger Action</label>
                  <textarea 
                    className="w-full bg-editor-bg border border-border-main rounded p-2 text-xs outline-none focus:border-vscode-blue min-h-[80px]"
                    placeholder="Describe what the trigger should do..."
                    value={triggerConfig.action}
                    onChange={e => setTriggerConfig({...triggerConfig, action: e.target.value})}
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setShowTriggerDialog(false)} className="px-4 py-1.5 text-[11px] font-bold text-[#858585] hover:text-white uppercase">Cancel</button>
                <button onClick={handleGenerateTrigger} className="px-4 py-1.5 bg-agent-teal text-black rounded text-[11px] font-bold uppercase transition-transform active:scale-95">Generate trigger</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentCard({ title, desc, icon: Icon, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="p-3 bg-[#2a2d2e] rounded border border-white/5 hover:border-agent-teal/40 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/5 rounded text-agent-teal group-hover:bg-agent-teal/20 transition-colors">
          <Icon size={16} />
        </div>
        <span className="text-[11px] font-bold text-white uppercase tracking-tight">{title}</span>
      </div>
      <p className="text-[10px] text-gray-500 line-clamp-2">{desc}</p>
    </div>
  );
}

function MarkdownOutput({ content, placeholder }: { content: string, placeholder: string }) {
  return (
    <div className="text-[#cccccc] text-xs leading-relaxed max-w-3xl prose prose-invert prose-sm">
      <ReactMarkdown>{content || `*${placeholder}*`}</ReactMarkdown>
    </div>
  );
}

function SidebarIcon({ icon: Icon, active, onClick, className }: { icon: any, active?: boolean, onClick: () => void, className?: string }) {
  return (
    <div 
      className={cn(
        "p-2 cursor-pointer transition-colors relative group",
        active ? "text-white opacity-100" : "text-white/60 hover:text-white/[0.8]"
      )}
      onClick={onClick}
    >
      <Icon size={24} strokeWidth={1.5} />
      {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white rounded-r pointer-events-none" />}
      <div className="absolute left-full ml-2 px-2 py-1 bg-panel-bg text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-border-main uppercase tracking-widest font-bold">
         {Icon.name}
      </div>
    </div>
  );
}

function PanelTabItem({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color?: string }) {
  return (
    <span 
      onClick={onClick}
      className={cn(
        "h-full flex items-center px-2 cursor-pointer transition-colors border-b-2",
        active ? (color ? `border-current ${color} text-white` : "border-white text-white") : "border-transparent hover:text-white",
        color && !active && `hover:${color}`
      )}
    >
      {label}
    </span>
  );
}

function QuickToolButton({ label, onClick, color }: { label: string, onClick: () => void, color: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "text-[10px] p-2 rounded border font-bold uppercase transition-all hover:brightness-125 whitespace-nowrap",
        color
      )}
    >
      {label}
    </button>
  );
}
