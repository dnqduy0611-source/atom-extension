import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import { readCurrentBrain } from "../commands/brain";
import { getConfig } from "../utils/config";

/**
 * Watches for comments matching configurable trigger patterns
 * (e.g. "# Remember: ...", "// Note: ...") and shows a CodeLens
 * offering to encode the comment content as a memory.
 *
 * Example:
 *   # Remember: JWT was chosen for stateless auth
 *     ^^ [Encode this memory?]
 */
export class CommentTriggerWatcher implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  constructor(private readonly _server: ServerLifecycle) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  /**
   * Register the provider and document change listeners.
   */
  activate(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = { scheme: "file" };

    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(selector, this),
    );

    // Re-fire when config changes (trigger patterns may update)
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("neuralmemory.commentTriggers")) {
          this._onDidChange.fire();
        }
      }),
    );

    // Register the inline encode command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "neuralmemory._encodeTriggerComment",
        async (content: string) => {
          if (!this._server.isRunning()) {
            vscode.window.showWarningMessage(
              "NeuralMemory server is not running.",
            );
            return;
          }

          const brainId = readCurrentBrain();
          const client = new NeuralMemoryClient(this._server.baseUrl);

          try {
            const result = await client.encode(brainId, { content });
            vscode.window.showInformationMessage(
              `Encoded: "${truncate(content, 50)}" (${result.neurons_created} neurons)`,
            );
            // Refresh to remove the CodeLens hint (memory now stored)
            this._onDidChange.fire();
          } catch (err) {
            vscode.window.showErrorMessage(
              `Encode failed: ${err instanceof Error ? err.message : err}`,
            );
          }
        },
      ),
    );
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    if (!this._server.isRunning()) {
      return [];
    }

    const patterns = buildTriggerPatterns();
    if (patterns.length === 0) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      const extracted = matchTrigger(lineText, patterns);

      if (!extracted) {
        continue;
      }

      const range = new vscode.Range(i, 0, i, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(light-bulb) Encode this memory?",
          command: "neuralmemory._encodeTriggerComment",
          arguments: [extracted],
          tooltip: `Encode: "${truncate(extracted, 80)}"`,
        }),
      );
    }

    return lenses;
  }
}

interface TriggerPattern {
  readonly regex: RegExp;
}

/**
 * Build regex patterns from the configured comment triggers.
 * Supports both // and # comment styles.
 */
function buildTriggerPatterns(): readonly TriggerPattern[] {
  const config = getConfig();
  const triggers = config.commentTriggers;

  if (triggers.length === 0) {
    return [];
  }

  const patterns: TriggerPattern[] = [];

  for (const trigger of triggers) {
    // Escape special regex chars in the trigger keyword
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Match: // trigger content  or  # trigger content
    // Also handles: /// and ## and multi-space
    patterns.push({
      regex: new RegExp(
        `^\\s*(?:\\/\\/+|#+)\\s*${escaped}\\s*(.+)$`,
        "i",
      ),
    });
  }

  return patterns;
}

/**
 * Try to match a line against trigger patterns.
 * Returns the extracted content after the trigger keyword, or undefined.
 */
function matchTrigger(
  lineText: string,
  patterns: readonly TriggerPattern[],
): string | undefined {
  for (const { regex } of patterns) {
    const match = lineText.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen
    ? `${text.slice(0, maxLen - 3)}...`
    : text;
}
