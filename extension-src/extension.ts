import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { registerAutocomplete } from './autocomplete';
import { generatePLSQL } from './sqlGenerator';
import { MCPClient } from './mcpClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('Nexus AI is now active!');

    // 1. AI Chat Panel
    const provider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
    );

    // 2. Tab Autocomplete
    registerAutocomplete(context);

    // 3. MCP Client for Databases
    const mcp = new MCPClient();
    context.subscriptions.push(
        vscode.commands.registerCommand('nexus-ai.connectDB', () => mcp.connect())
    );

    // 4. PL/SQL Generator
    context.subscriptions.push(
        vscode.commands.registerCommand('nexus-ai.generateSQL', async () => {
            const input = await vscode.window.showInputBox({ 
                prompt: 'Describe the stored procedure you need' 
            });
            if (input) {
                const code = await generatePLSQL(input);
                const doc = await vscode.workspace.openTextDocument({ content: code, language: 'sql' });
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    // 5. Agent Mode (Example implementation)
    context.subscriptions.push(
        vscode.commands.registerCommand('nexus-ai.agentTask', async () => {
            const task = await vscode.window.showInputBox({ prompt: 'What task should the agent perform?' });
            if (task) {
                vscode.window.showInformationMessage(`Agent started task: ${task}`);
                // In a real implementation, this would start a loop that 
                // calls AI to generate steps, then executes them using 
                // vscode.workspace.fs and vscode.window.createTerminal
            }
        })
    );
}

export function deactivate() {}
