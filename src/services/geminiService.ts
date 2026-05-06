import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { LLMModel } from "../types";
import { MODELS } from "../constants";

const defaultAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const readFileTool: FunctionDeclaration = {
  name: "read_file",
  description: "Read the content of a file at a given path.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path to the file." },
    },
    required: ["path"],
  },
};

const writeFileTool: FunctionDeclaration = {
  name: "write_file",
  description: "Write content to a file at a given path. This will overwrite existing files or create new ones.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path to the file." },
      content: { type: Type.STRING, description: "The full content to write to the file." },
    },
    required: ["path", "content"],
  },
};

const runCommandTool: FunctionDeclaration = {
  name: "run_command",
  description: "Execute a shell command in the project directory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: { type: Type.STRING, description: "The shell command to run." },
    },
    required: ["command"],
  },
};

const listFilesTool: FunctionDeclaration = {
  name: "list_files",
  description: "List all files in the project to understand the structure.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const queryDatabaseTool: FunctionDeclaration = {
  name: "query_database",
  description: "Execute a SQL query against the connected database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sql: { type: Type.STRING, description: "The SQL query to run." },
      connectionId: { type: Type.STRING, description: "The database connection ID." }
    },
    required: ["sql", "connectionId"],
  },
};

const listTablesTool: FunctionDeclaration = {
  name: "list_tables",
  description: "List all tables in the database schema.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      connectionId: { type: Type.STRING, description: "The database connection ID." }
    },
    required: ["connectionId"],
  },
};

const insertCodeTool: FunctionDeclaration = {
  name: "insert_code",
  description: "Insert a block of code at the current cursor position in the active editor.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: { type: Type.STRING, description: "The code block to insert." },
    },
    required: ["content"],
  },
};

export async function* chatStream(messages: { role: string; content: string }[], modelConfig?: LLMModel) {
  const config = modelConfig || MODELS[0];
  // Map provided model IDs to actual Gemini model names if necessary
  const modelName = config.id.toLowerCase().includes("gemini") ? config.id : "gemini-2.0-flash";
  
  console.log(`[ChatStream] Using model: ${modelName} (${config.provider})`);
  
  // Use custom API key if provided, otherwise fallback to environment key
  const ai = config.apiKey 
    ? new GoogleGenAI({ apiKey: config.apiKey })
    : defaultAi;

  const formattedMessages = messages.map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }]
  }));

  const chat = ai.chats.create({
    model: modelName,
    history: formattedMessages.slice(0, -1),
    config: {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 2048,
      topP: config.topP ?? 0.9,
      systemInstruction: `You are Nexus Agent, a world-class AI software engineer.
      
Your goal is to help the user complete complex programming tasks autonomously.
When given a task:
1. THINK about the approach.
2. PLAN the steps (which files to read, what code to write, which commands to run, or database queries to execute).
3. EXECUTE via tools.

You have access to:
- list_files: To see the project structure.
- read_file: To understand existing code.
- write_file: To create or modify code.
- insert_code: To insert a snippet at the cursor in the active editor.
- run_command: To build, test, or install dependencies.
- query_database: To interact with connected MCP databases.
- list_tables: To inspect database schema.

Always be concise and prioritize code quality.`,
      tools: [{ 
        functionDeclarations: [readFileTool, writeFileTool, runCommandTool, listFilesTool, queryDatabaseTool, listTablesTool, insertCodeTool] 
      }],
    }
  });

  const result = await chat.sendMessageStream({
    message: messages[messages.length - 1].content,
  });

  for await (const chunk of result) {
    // If the chunk has text, yield it
    if (chunk.text) {
      yield { type: 'text', content: chunk.text };
    }
    
    // If the chunk has function calls, yield them
    if (chunk.functionCalls) {
      yield { type: 'tools', content: chunk.functionCalls };
    }
  }
}

export async function getCodeCompletion(prefix: string, suffix: string, filename: string) {
  // Use a faster model for completions
  const model = "gemini-1.5-flash"; 
  
  const prompt = `You are a code completion engine (sub-100ms goal). 
Filename: ${filename}
Code before cursor:
${prefix}
Code after cursor:
${suffix}

Provide the NEXT few lines of code to complete the current thought. 
Output ONLY the code completion. Do not provide explanations. Keep it under 50 tokens.`;

  try {
    const result = await defaultAi.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 50,
        temperature: 0.1, 
      }
    });
    return result.text;
  } catch (err) {
    console.error("Completion error", err);
    return "";
  }
}

export async function generatePLSQL(type: 'procedure' | 'trigger' | 'package', description: string, config?: any) {
  let systemPrompt = "";
  if (type === 'procedure') {
    systemPrompt = `Generate a PL/SQL stored procedure following Oracle best practices:
- Prefix parameters with p_ (IN) or out_ (OUT)
- Use %TYPE and %ROWTYPE for column references
- Include proper exception handling (NO_DATA_FOUND, TOO_MANY_ROWS, OTHERS)
- Add COMMIT only when appropriate
- Include comments explaining each major section
- Use proper indentation (3 spaces)
- Return status via OUT parameter or function return
Return ONLY the procedure code, no markdown or explanations.`;
  } else if (type === 'trigger') {
    systemPrompt = `Generate a PL/SQL trigger with:
- Table: ${config?.table}
- Timing: ${config?.timing}
- Event: ${config?.event}
- What it does: ${description}

Requirements:
- Name: trg_${config?.table?.toLowerCase()}_${config?.event?.toLowerCase()}
- Include :OLD and :NEW references as appropriate
- Add conditional logic if needed
- Include error handling
- Log to audit table if necessary
Return ONLY the trigger code, no markdown or explanations.`;
  } else if (type === 'package') {
    systemPrompt = `Generate a complete PL/SQL package (specification and body) for:
${description}

Requirements:
- Specification includes all public procedures/functions with proper DETERMINISTIC/PRAGMA
- Body implements all procedures/functions
- Include private helper functions if needed
- Add proper comments
- Follow naming conventions: pkg_ prefix
Return both spec and body in one response, no markdown or explanations.`;
  }

  const result = await defaultAi.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nTask: ${description}` }] }],
    config: { temperature: 0.2 }
  });
  return cleanPLSQLCode(result.text);
}

export async function transformSQL(code: string, mode: 'explain' | 'convert' | 'document' | 'review' | 'test' | 'profile' | 'refactor') {
  const prompts = {
    explain: "Explain this PL/SQL code in detail. Include: purpose, logic flow, potential issues, and suggestions.",
    convert: "Convert this PL/SQL code to T-SQL (SQL Server). Maintain the same logic but use T-SQL syntax. Return only the converted code.",
    document: "Generate comprehensive documentation for this PL/SQL code including: purpose, parameters, return values, exceptions, and usage examples.",
    review: `Perform a comprehensive code review of this PL/SQL code.
Focus on:
- Security vulnerabilities (SQL injection, unsafe defaults)
- Oracle best practices
- Naming conventions
- Code readability and maintainability
- Performance concerns
- Error handling completeness
Provide clear, actionable feedback.`,
    test: `Generate comprehensive unit tests for this PL/SQL code.
Include:
- Happy path scenarios
- Boundary/Edge cases
- Error/Exception handling cases
Use a standard testing framework approach (e.g. utPLSQL) or provided anonymous blocks for verification.`,
    profile: `Analyze this PL/SQL code for performance bottlenecks.
Look for:
- Unnecessary loops or context switching
- Inefficient queries or lack of bulk operations (FORALL, BULK COLLECT)
- Resource-heavy operations
- Indexing opportunities
Suggest specific optimizations and rewrite parts of the code for better performance if applicable.`,
    refactor: `Suggest a significant but safe refactoring for this PL/SQL code. 
Focus on:
- Consolidating logic
- Improving maintainability
- Removing redundant code
- Modernizing patterns
Return ONLY the refactored code block.`
  };

  const result = await defaultAi.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [{ role: "user", parts: [{ text: `${prompts[mode]}\n\nCode:\n${code}` }] }],
  });
  
  if (mode === 'convert') {
    return cleanPLSQLCode(result.text);
  }
  return result.text;
}

function cleanPLSQLCode(code: string): string {
  // Remove markdown blocks
  let cleaned = code.replace(/```sql\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');
  cleaned = cleaned.trim();
  
  // Ensure ends with slash if it's PL/SQL (not strictly necessary for T-SQL but requested in user_request snippet)
  if (!cleaned.endsWith('/')) {
    cleaned += '\n/';
  }
  
  return cleaned;
}
