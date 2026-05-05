import * as vscode from 'vscode';

export function registerAutocomplete(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        {
            async provideInlineCompletionItems(document, position, context, token) {
                // Throttling / Debouncing is usually handled by the VS Code host 
                // but we can add a deliberate delay or check context
                
                // Throttling logic (Simulated)
                const lastRequestTime = (global as any).lastAutocompleteTime || 0;
                const now = Date.now();
                if (now - lastRequestTime < 150) {
                    return; // Smart Throttle
                }
                (global as any).lastAutocompleteTime = now;

                // Call AI to get completion
                // const suggestion = await fetchAISuggestion(document.getText(), position);
                
                const item = new vscode.InlineCompletionItem(' // AI Suggestion\nconsole.log("Nexus Autocomplete Active");');
                return [item];
            }
        }
    );

    context.subscriptions.push(provider);
}
