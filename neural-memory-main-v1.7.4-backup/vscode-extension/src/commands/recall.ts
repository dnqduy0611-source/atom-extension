import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import type { QueryResponse } from "../server/types";
import { readCurrentBrain } from "./brain";

const DEPTH_OPTIONS: readonly vscode.QuickPickItem[] = [
  { label: "Auto", description: "Let the system choose the best depth" },
  { label: "Instant (0)", description: "Fastest — reflex match only" },
  { label: "Context (1)", description: "Spreading activation, 1 hop" },
  { label: "Habit (2)", description: "Pattern-based, 2 hops" },
  { label: "Deep (3)", description: "Full search, max hops" },
];

function parseDepth(label: string): number | undefined {
  const match = label.match(/\((\d)\)/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Register the recall command.
 */
export function registerRecallCommands(
  context: vscode.ExtensionContext,
  server: ServerLifecycle,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("neuralmemory.recall", async () => {
      if (!server.isRunning()) {
        vscode.window.showWarningMessage(
          "NeuralMemory server is not running.",
        );
        return;
      }

      // 1. Query input
      const query = await vscode.window.showInputBox({
        prompt: "What do you want to recall?",
        placeHolder: "e.g. What was decided about authentication?",
        ignoreFocusOut: true,
      });

      if (!query) {
        return;
      }

      // 2. Depth selection
      const depthPick = await vscode.window.showQuickPick(DEPTH_OPTIONS, {
        placeHolder: "Select retrieval depth",
        title: "Recall Depth",
      });

      if (!depthPick) {
        return;
      }

      const depth = parseDepth(depthPick.label);
      const brainId = readCurrentBrain();
      const client = new NeuralMemoryClient(server.baseUrl);

      // 3. Execute query with progress
      let result: QueryResponse;
      try {
        result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Recalling memories...",
            cancellable: false,
          },
          async () => client.query(brainId, { query, depth }),
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Recall failed: ${err instanceof Error ? err.message : err}`,
        );
        return;
      }

      // 4. No results
      if (!result.answer && result.fibers_matched.length === 0) {
        vscode.window.showInformationMessage(
          "No memories found for that query.",
        );
        return;
      }

      // 5. Show results in QuickPick
      await showRecallResults(query, result);
    }),
  );
}

interface RecallResultItem extends vscode.QuickPickItem {
  readonly action: "paste" | "copy" | "details";
  readonly text: string;
}

async function showRecallResults(
  query: string,
  result: QueryResponse,
): Promise<void> {
  const depthLabels = ["INSTANT", "CONTEXT", "HABIT", "DEEP"];
  const depthLabel = depthLabels[result.depth_used] ?? `${result.depth_used}`;
  const confidencePct = Math.round(result.confidence * 100);

  const answer = result.answer ?? result.context;
  const answerPreview = answer.length > 120
    ? `${answer.slice(0, 117)}...`
    : answer;

  const items: RecallResultItem[] = [
    {
      label: "$(paste) Paste to editor",
      description: answerPreview,
      detail: `Confidence: ${confidencePct}% | Depth: ${depthLabel} | ${result.neurons_activated} neurons | ${result.latency_ms.toFixed(1)}ms`,
      action: "paste",
      text: answer,
    },
    {
      label: "$(copy) Copy to clipboard",
      description: answerPreview,
      action: "copy",
      text: answer,
    },
    {
      label: "$(info) Show full details",
      description: `${result.fibers_matched.length} fibers matched`,
      action: "details",
      text: answer,
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Results for: "${query}"`,
    title: `Recall — ${confidencePct}% confidence`,
    matchOnDescription: true,
  });

  if (!selected) {
    return;
  }

  switch (selected.action) {
    case "paste":
      await pasteToEditor(selected.text);
      break;

    case "copy":
      await vscode.env.clipboard.writeText(selected.text);
      vscode.window.showInformationMessage("Copied to clipboard.");
      break;

    case "details":
      await showFullDetails(query, result);
      break;
  }
}

async function pasteToEditor(text: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // No active editor — copy to clipboard instead
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(
      "No active editor. Copied to clipboard instead.",
    );
    return;
  }

  await editor.edit((editBuilder) => {
    if (editor.selection.isEmpty) {
      editBuilder.insert(editor.selection.active, text);
    } else {
      editBuilder.replace(editor.selection, text);
    }
  });
}

async function showFullDetails(
  query: string,
  result: QueryResponse,
): Promise<void> {
  const depthLabels = ["INSTANT", "CONTEXT", "HABIT", "DEEP"];
  const depthLabel = depthLabels[result.depth_used] ?? `${result.depth_used}`;

  const lines = [
    `Query: "${query}"`,
    `${"─".repeat(60)}`,
    `Confidence: ${Math.round(result.confidence * 100)}%`,
    `Depth: ${depthLabel}`,
    `Neurons activated: ${result.neurons_activated}`,
    `Fibers matched: ${result.fibers_matched.length}`,
    `Latency: ${result.latency_ms.toFixed(1)}ms`,
    `${"─".repeat(60)}`,
    "",
    result.answer ?? "(no direct answer)",
    "",
    `${"─".repeat(60)}`,
    "Context:",
    "",
    result.context,
  ];

  if (result.fibers_matched.length > 0) {
    lines.push("", `${"─".repeat(60)}`, "Matched fiber IDs:");
    for (const fiberId of result.fibers_matched) {
      lines.push(`  - ${fiberId}`);
    }
  }

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });

  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
}
