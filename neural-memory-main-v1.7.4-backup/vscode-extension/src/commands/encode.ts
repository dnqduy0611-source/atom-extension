import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import { readCurrentBrain } from "./brain";

const TAG_OPTIONS: readonly vscode.QuickPickItem[] = [
  { label: "fact", description: "A factual piece of information" },
  { label: "decision", description: "A decision that was made" },
  { label: "todo", description: "Something to do later" },
  { label: "idea", description: "An idea or proposal" },
  { label: "context", description: "Background context" },
  { label: "error", description: "An error or issue encountered" },
];

/**
 * Register encode-related commands.
 */
export function registerEncodeCommands(
  context: vscode.ExtensionContext,
  server: ServerLifecycle,
): void {
  // Encode selection (or fall back to input)
  context.subscriptions.push(
    vscode.commands.registerCommand("neuralmemory.encode", async () => {
      if (!server.isRunning()) {
        vscode.window.showWarningMessage(
          "NeuralMemory server is not running.",
        );
        return;
      }

      // Try to get selected text from active editor
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.selection;
      let content = selection && !selection.isEmpty
        ? editor.document.getText(selection)
        : undefined;

      // Fall back to input box if no selection
      if (!content) {
        content = await promptForContent();
        if (!content) {
          return;
        }
      }

      await encodeContent(server, content);
    }),
  );

  // Encode from input box (always)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "neuralmemory.encodeInput",
      async () => {
        if (!server.isRunning()) {
          vscode.window.showWarningMessage(
            "NeuralMemory server is not running.",
          );
          return;
        }

        const content = await promptForContent();
        if (!content) {
          return;
        }

        await encodeContent(server, content);
      },
    ),
  );
}

async function promptForContent(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "What do you want to remember?",
    placeHolder: "Enter memory content...",
    ignoreFocusOut: true,
  });
}

async function encodeContent(
  server: ServerLifecycle,
  content: string,
): Promise<void> {
  // Ask for optional tags
  const tagPicks = await vscode.window.showQuickPick(TAG_OPTIONS, {
    placeHolder: "Select tags (optional, press Escape to skip)",
    canPickMany: true,
    title: "Memory Tags",
  });

  const tags = tagPicks && tagPicks.length > 0
    ? tagPicks.map((t) => t.label)
    : undefined;

  const brainId = readCurrentBrain();
  const client = new NeuralMemoryClient(server.baseUrl);

  // Truncate display content for notification
  const displayContent = content.length > 60
    ? `${content.slice(0, 57)}...`
    : content;

  try {
    const result = await client.encode(brainId, { content, tags });

    vscode.window.showInformationMessage(
      `Remembered: "${displayContent}" (${result.neurons_created} neurons, ${result.synapses_created} synapses)`,
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to encode: ${err instanceof Error ? err.message : err}`,
    );
  }
}
