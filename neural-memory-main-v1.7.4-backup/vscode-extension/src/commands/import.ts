import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import type { ImportSource } from "../server/types";
import { readCurrentBrain } from "./brain";

interface SourceOption extends vscode.QuickPickItem {
  readonly source: ImportSource;
  readonly connectionLabel: string;
  readonly connectionPlaceholder: string;
}

const SOURCE_OPTIONS: readonly SourceOption[] = [
  {
    label: "$(database) ChromaDB",
    description: "Vector database",
    source: "chromadb",
    connectionLabel: "ChromaDB persist path",
    connectionPlaceholder: "/path/to/chroma/persist",
  },
  {
    label: "$(cloud) Mem0",
    description: "Memory layer",
    source: "mem0",
    connectionLabel: "Mem0 API key",
    connectionPlaceholder: "m0-...",
  },
  {
    label: "$(folder) AWF",
    description: "Antigravity .brain/ directory",
    source: "awf",
    connectionLabel: "Path to .brain/ directory",
    connectionPlaceholder: "/path/to/.brain",
  },
  {
    label: "$(type-hierarchy) Cognee",
    description: "Knowledge graph",
    source: "cognee",
    connectionLabel: "Cognee API key (or leave blank for env)",
    connectionPlaceholder: "cognee-api-key",
  },
  {
    label: "$(git-merge) Graphiti",
    description: "Bi-temporal knowledge graph (Zep)",
    source: "graphiti",
    connectionLabel: "Graph DB URI",
    connectionPlaceholder: "bolt://localhost:7687",
  },
  {
    label: "$(book) LlamaIndex",
    description: "Index / RAG framework",
    source: "llamaindex",
    connectionLabel: "Persisted index directory",
    connectionPlaceholder: "/path/to/index/storage",
  },
];

/**
 * Register the import memories command.
 */
export function registerImportCommands(
  context: vscode.ExtensionContext,
  server: ServerLifecycle,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "neuralmemory.importMemories",
      async () => {
        if (!server.isRunning()) {
          vscode.window.showWarningMessage(
            "NeuralMemory server is not running.",
          );
          return;
        }

        // 1. Pick source
        const picked = await vscode.window.showQuickPick(SOURCE_OPTIONS, {
          placeHolder: "Select source system to import from",
          title: "Import Memories",
        });
        if (!picked) {
          return;
        }

        // 2. Connection string
        const connection = await vscode.window.showInputBox({
          prompt: picked.connectionLabel,
          placeHolder: picked.connectionPlaceholder,
          title: `${picked.label} — Connection`,
        });
        // Allow empty connection (some adapters use env vars)

        // 3. Collection (optional)
        const collection = await vscode.window.showInputBox({
          prompt: "Collection or namespace (optional)",
          placeHolder: "Leave empty for all",
          title: `${picked.label} — Collection`,
        });

        // 4. Limit (optional)
        const limitStr = await vscode.window.showInputBox({
          prompt: "Max records to import (optional)",
          placeHolder: "100",
          title: `${picked.label} — Limit`,
          validateInput: (value) => {
            if (!value) {
              return null;
            }
            const n = Number(value);
            if (Number.isNaN(n) || n < 1 || !Number.isInteger(n)) {
              return "Enter a positive integer";
            }
            return null;
          },
        });

        const brainId = readCurrentBrain();
        const client = new NeuralMemoryClient(server.baseUrl);

        try {
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Importing from ${picked.source}...`,
              cancellable: false,
            },
            () =>
              client.importMemories(brainId, {
                source: picked.source,
                connection: connection || undefined,
                collection: collection || undefined,
                limit: limitStr ? Number(limitStr) : undefined,
              }),
          );

          vscode.window.showInformationMessage(result.message);
        } catch (err) {
          vscode.window.showErrorMessage(
            `Import failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      },
    ),
  );
}
