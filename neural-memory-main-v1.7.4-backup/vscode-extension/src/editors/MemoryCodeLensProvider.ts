import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import { readCurrentBrain } from "../commands/brain";
import { getConfig } from "../utils/config";

/**
 * Regex patterns to detect function/class declarations across common languages.
 * Each match group 1 captures the symbol name.
 */
const SYMBOL_PATTERNS: readonly RegExp[] = [
  // Python: def foo(...) / async def foo(...) / class Foo
  /^\s*(?:async\s+)?def\s+(\w+)\s*\(/,
  /^\s*class\s+(\w+)/,
  // JS/TS: function foo / async function foo / class Foo
  /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  /^\s*(?:export\s+)?class\s+(\w+)/,
  // JS/TS: const foo = (...) => / const foo = function
  /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)/,
  // Go: func Foo(
  /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
  // Rust: fn foo( / pub fn foo(
  /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
  // Java/C#: public void foo( / private static int bar(
  /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(/,
];

interface CachedResult {
  readonly version: number;
  readonly lenses: vscode.CodeLens[];
}

/**
 * Provides CodeLens above function/class declarations showing
 * how many memories are related, with quick Recall/Encode actions.
 *
 * Example:
 *   [3 memories] [Recall] [Encode]
 *   def authenticate_user(credentials):
 */
export class MemoryCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  private readonly _cache = new Map<string, CachedResult>();
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly _server: ServerLifecycle) {}

  refresh(): void {
    this._cache.clear();
    this._onDidChange.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    const config = getConfig();
    if (!config.codeLensEnabled || !this._server.isRunning()) {
      return [];
    }

    // Return cached if document version matches
    const cached = this._cache.get(document.uri.toString());
    if (cached && cached.version === document.version) {
      return cached.lenses;
    }

    // Scan for symbols synchronously — just create placeholder lenses
    const lenses: vscode.CodeLens[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const symbolName = extractSymbolName(line.text);
      if (!symbolName) {
        continue;
      }

      const range = new vscode.Range(i, 0, i, 0);

      // Placeholder lens — resolved async in resolveCodeLens
      const lens = new MemoryCodeLens(range, symbolName);
      lenses.push(lens);
    }

    this._cache.set(document.uri.toString(), {
      version: document.version,
      lenses,
    });

    // Schedule debounced background resolution
    this._scheduleResolve(document.uri);

    return lenses;
  }

  async resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens | null> {
    if (!(codeLens instanceof MemoryCodeLens)) {
      return codeLens;
    }

    if (!this._server.isRunning()) {
      codeLens.command = {
        title: "NeuralMemory: disconnected",
        command: "",
      };
      return codeLens;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const symbolName = codeLens.symbolName;

    try {
      const brainId = readCurrentBrain();
      const client = new NeuralMemoryClient(this._server.baseUrl);
      const result = await client.listNeurons(brainId, {
        contentContains: symbolName,
        limit: 5,
      });

      const count = result.count;

      if (count === 0) {
        codeLens.command = {
          title: "No memories",
          command: "neuralmemory.encode",
          tooltip: `Encode "${symbolName}" as a memory`,
        };
      } else {
        codeLens.command = {
          title: `${count} memor${count === 1 ? "y" : "ies"}`,
          command: "neuralmemory.recall",
          tooltip: `Recall memories related to "${symbolName}"`,
        };
      }
    } catch {
      codeLens.command = {
        title: "NeuralMemory",
        command: "",
      };
    }

    return codeLens;
  }

  private _scheduleResolve(_uri: vscode.Uri): void {
    if (this._debounceTimer !== undefined) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      // Force re-render of lenses to trigger resolveCodeLens
      this._onDidChange.fire();
      this._debounceTimer = undefined;
    }, 500);
  }
}

class MemoryCodeLens extends vscode.CodeLens {
  constructor(
    range: vscode.Range,
    public readonly symbolName: string,
  ) {
    super(range);
  }
}

function extractSymbolName(lineText: string): string | undefined {
  for (const pattern of SYMBOL_PATTERNS) {
    const match = lineText.match(pattern);
    if (match?.[1]) {
      // Skip common non-meaningful names
      const name = match[1];
      if (name.startsWith("_") && name !== "__init__") {
        return undefined;
      }
      if (name.length < 3) {
        return undefined;
      }
      return name;
    }
  }
  return undefined;
}
