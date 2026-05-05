# Nexus AI Editor & VS Code Extension

Welcome to Nexus AI, a full-featured AI-powered code editor clone of Cursor.

## 🚀 Web App Features (Live Preview)
- **AI Chat Panel**: Real-time streaming using Gemini 3.1 Pro.
- **Agent Mode**: Integrated terminal and file system access (simulated in sandbox).
- **Monaco Editor**: High-performance editing with rich language support.
- **MCP Database Explorer**: View and query connected databases via Model Context Protocol.

## 📦 VS Code Extension Source
The `/extension-src` directory contains the complete source code for a real VS Code extension:
- `package.json`: Manifest with custom views and settings.
- `extension.ts`: Main activation logic for chat, autocomplete, and SQL generation.
- `autocomplete.ts`: Inline completion provider with 150ms debounce logic.
- `mcp-config.json`: Example configuration for Model Context Protocol servers.

### How to Install the Extension locally:
1. Clone this project or download the `extension-src` folder.
2. Open the folder in VS Code.
3. Run `npm install` inside `extension-src`.
4. Press `F5` to open a new [Extension Development Host] window.
5. Search for "Nexus AI: Open Chat" in the command palette.

## 🛠 Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, Monaco Editor.
- **Backend**: Node.js Express (for file system agentic actions).
- **AI**: Google Gemini API (via `@google/genai`).

## ⚙️ Settings (settings.json defaults)
```json
{
    "nexus-ai.provider": "google",
    "nexus-ai.apiKey": "YOUR_GEMINI_API_KEY",
    "nexus-ai.agent.maxSteps": 10,
    "editor.inlineSuggest.enabled": true
}
```
