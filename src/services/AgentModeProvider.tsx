import React, { createContext, useContext, useState, useCallback } from 'react';
import { AgentAction, AgentTask } from '../types';
import { chatStream } from './geminiService';

interface AgentModeContextType {
  tasks: AgentTask[];
  activeTask: AgentTask | null;
  addTask: (instruction: string) => void;
  executeStep: (taskId: string, actionId: string) => Promise<void>;
  retryStep: (taskId: string, actionId: string) => Promise<void>;
}

const AgentModeContext = createContext<AgentModeContextType | undefined>(undefined);

export const AgentModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);

  const addTask = (instruction: string) => {
    const newTask: AgentTask = {
      id: Math.random().toString(36).substr(2, 9),
      instruction,
      status: 'pending',
      steps: [],
      createdAt: new Date(),
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTask(newTask);
  };

  const updateActionStatus = useCallback((taskId: string, actionId: string, status: AgentAction['status'], result?: string, reasoning?: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          steps: task.steps.map(step => {
            if (step.id === actionId) {
              return { ...step, status, result: result || step.result, reasoning: reasoning || step.reasoning };
            }
            return step;
          })
        };
      }
      return task;
    }));
  }, []);

  const executeStep = async (taskId: string, actionId: string, retryCount = 0) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const action = task.steps.find(s => s.id === actionId);
    if (!action) return;

    updateActionStatus(taskId, actionId, 'running');

    try {
      let resultData: any;
      
      // Attempt execution
      switch (action.type) {
        case 'write_file':
        case 'create_file':
          if (!action.path || action.content === undefined) {
            throw new Error(`Execution Error: Missing path or content for ${action.type}`);
          }
          const writeRes = await fetch('/api/write-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: action.path, content: action.content })
          });
          if (!writeRes.ok) throw new Error(`HTTP error! status: ${writeRes.status}`);
          resultData = await writeRes.json();
          if (!resultData.success) {
            throw new Error(`FileSystem Error: Failed to write to "${action.path}". ${resultData.error || 'Check permissions or path validity.'}`);
          }
          break;
          
        case 'run_command':
          if (!action.command) throw new Error('Terminal Error: No command provided');
          const cmdRes = await fetch('/api/terminal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: action.command })
          });
          if (!cmdRes.ok) throw new Error(`HTTP error! status: ${cmdRes.status}`);
          resultData = await cmdRes.json();
          if (resultData.stderr && !resultData.stdout) {
             // Heuristic: If there's stderr but no stdout, it's likely a failure in many CLI tools
             throw new Error(`CLI Failure: ${resultData.stderr.split('\n')[0]}`);
          }
          break;
          
        case 'read_file':
          if (!action.path) throw new Error('FileSystem Error: No path provided for read_file');
          const readRes = await fetch('/api/read-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: action.path })
          });
          if (!readRes.ok) throw new Error(`HTTP error! status: ${readRes.status}`);
          resultData = await readRes.json();
          if (resultData.error) {
            throw new Error(`FileSystem Error: Could not read "${action.path}". ${resultData.error || 'File might not exist.'}`);
          }
          break;

        case 'query_database':
          if (!action.command) throw new Error('Database Error: No SQL query provided');
          const dbRes = await fetch('/api/mcp/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              toolName: 'query_database', 
              args: { sql: action.command, connectionId: action.path || "1" } 
            })
          });
          if (!dbRes.ok) throw new Error(`HTTP error! status: ${dbRes.status}`);
          resultData = await dbRes.json();
          break;

        default:
          // Simulate other types for now
          await new Promise(resolve => setTimeout(resolve, 1000));
          resultData = { success: true, message: `Completed ${action.type}` };
      }

      updateActionStatus(taskId, actionId, 'completed', JSON.stringify(resultData));
      
    } catch (err) {
      const errorMessage = (err as Error).message;
      
      // Automatic Retry Logic
      if (retryCount < 2) {
        console.warn(`Step ${actionId} failed. Retrying... (${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential-ish backoff
        return executeStep(taskId, actionId, retryCount + 1);
      }

      // If retries fail, request Intelligent Recovery Suggestion
      const recoveryReasoning = await getRecoverySuggestion(action, errorMessage);
      updateActionStatus(taskId, actionId, 'failed', `Error after retries: ${errorMessage}`, recoveryReasoning);
    }
  };

  const getRecoverySuggestion = async (action: AgentAction, error: string) => {
    try {
      const prompt = `The AI agent tried to execute the following action:
Type: ${action.type}
Description: ${action.description}
Parameters: ${JSON.stringify({ path: action.path, command: action.command })}

It failed with this error:
"${error}"

Analyze why it might have failed and suggest a specific technical recovery path. 
Should I check if the file exists? Is it a syntax error? Should I try a different command?
Provide a concise, expert diagnosis and next step.`;

      const stream = chatStream([{ role: 'user', content: prompt }]);
      let suggestion = "";
      for await (const chunk of stream) {
        if (chunk.type === 'text') suggestion += chunk.content;
      }
      return suggestion;
    } catch (err) {
      return "Failed to generate recovery suggestion.";
    }
  };

  const retryStep = async (taskId: string, actionId: string) => {
    return executeStep(taskId, actionId, 0);
  };

  return (
    <AgentModeContext.Provider value={{ tasks, activeTask, addTask, executeStep, retryStep }}>
      {children}
    </AgentModeContext.Provider>
  );
};

export const useAgentMode = () => {
  const context = useContext(AgentModeContext);
  if (context === undefined) {
    throw new Error('useAgentMode must be used within an AgentModeProvider');
  }
  return context;
};
