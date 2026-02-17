// sidepanel/chat/chat_actions.js
// Handles commands: /focus, /journal, /save, /insight (NEW)

export const ChatActions = {
    // 1. FOCUS: Start focus timer
    focus: async (args) => {
        const minutes = parseInt(args[0]) || 25;
        chrome.runtime.sendMessage({ type: 'FOCUS_START', minutes });
        return {
            type: 'system',
            content: `🎯 Focus mode started for ${minutes} minutes.`
        };
    },

    // 2. JOURNAL: Log entry
    journal: async (args) => {
        const entry = args.join(' ');
        if (!entry) return { type: 'error', content: 'Usage: /journal [your note]' };
        
        // Save to daily note (implied via message saving)
        return {
            type: 'system',
            content: `📝 Journal entry saved: "${entry}"`
        };
    },

    // 3. SAVE: Save selection to Memory
    save: async () => {
        // Trigger save logic (usually handled by floating button, but here as backup)
        chrome.runtime.sendMessage({
            type: 'SRQ_CREATE_CARD',
            payload: { /* ... active tab info ... */ }
        });
        return { type: 'system', content: '✅ Saved to Knowledge Graph.' };
    },

    // 4. INSIGHT (New Refactor): Generate Key Insight
    insight: async (context) => {
        // Call AI Router (Placeholder - actual implementation needs router.js)
        // Intent: 'INSIGHT' or 'SUMMARY'
        // Context: Page Content + Selection
        
        /* 
           TODO: Replace with actual AI Router call once Phase 4 is fully merged.
           For now, simulate the response structure.
        */
        const mockInsight = "💡 Core Insight: This article argues that AI should be a tool for thought, not a replacement for thinking.";
        
        // Auto-save to Memory
        chrome.runtime.sendMessage({
            type: 'MEMORY_SAVE',
            payload: { content: mockInsight, type: 'insight' }
        });

        return {
            type: 'ai',
            content: mockInsight,
            isInsight: true // Flag for UI styling
        };
    }
};

export async function executeCommand(input, context) {
    const [cmd, ...args] = input.slice(1).split(' ');
    const action = ChatActions[cmd.toLowerCase()];
    
    if (action) {
        return await action(args, context);
    }
    return null;
}
