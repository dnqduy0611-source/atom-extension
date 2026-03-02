import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findFreePort } from "../utils/port";
import { getConfig } from "../utils/config";

const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_POLL_TIMEOUT_MS = 15_000;
const LOCK_FILE_NAME = ".server.lock";

interface LockFileData {
  readonly pid: number;
  readonly port: number;
  readonly started_at: string;
  readonly owner: string;
}

type ReadyCallback = () => void;
type ErrorCallback = (err: Error) => void;

/**
 * Manages the NeuralMemory server lifecycle with a detect-first,
 * spawn-fallback strategy. Uses a lock file to implement singleton
 * pattern across multiple VS Code windows.
 */
export class ServerLifecycle implements vscode.Disposable {
  private _baseUrl = "";
  private _process: cp.ChildProcess | null = null;
  private _running = false;
  private _ownedProcess = false;
  private _disposed = false;

  private readonly _readyCallbacks: ReadyCallback[] = [];
  private readonly _errorCallbacks: ErrorCallback[] = [];
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _outputChannel: vscode.OutputChannel;

  constructor(_context: vscode.ExtensionContext) {
    this._outputChannel = vscode.window.createOutputChannel("NeuralMemory Server");
    this._disposables.push(this._outputChannel);
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  isRunning(): boolean {
    return this._running;
  }

  isOwnedProcess(): boolean {
    return this._ownedProcess;
  }

  /**
   * Primary entry point: try to connect to an existing server,
   * fall back to spawning a new one if autoStart is enabled.
   */
  async connectOrStart(): Promise<void> {
    const config = getConfig();

    // Step 1: Try configured server URL
    this._log(`Checking for server at ${config.serverUrl}...`);
    if (await this._healthCheck(config.serverUrl)) {
      this._baseUrl = config.serverUrl;
      this._running = true;
      this._log(`Connected to existing server at ${config.serverUrl}`);
      this._notifyReady();
      return;
    }

    // Step 2: Check lock file for running server on different port
    const lockData = this._readLockFile();
    if (lockData) {
      const lockUrl = `http://127.0.0.1:${lockData.port}`;
      this._log(`Found lock file, checking ${lockUrl}...`);
      if (await this._healthCheck(lockUrl)) {
        this._baseUrl = lockUrl;
        this._running = true;
        this._log(`Connected to server from lock file at ${lockUrl}`);
        this._notifyReady();
        return;
      }
      // Stale lock file — clean it up
      this._log("Lock file is stale, removing...");
      this._removeLockFile();
    }

    // Step 3: Spawn if autoStart enabled
    if (config.autoStart) {
      await this.start();
      return;
    }

    // Step 4: No server found, prompt user
    this._log("No server found. Prompting user...");
    const action = await vscode.window.showWarningMessage(
      "NeuralMemory server not found. Start it or configure a URL.",
      "Start Server",
      "Configure URL",
    );

    if (action === "Start Server") {
      await this.start();
    } else if (action === "Configure URL") {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "neuralmemory.serverUrl",
      );
    }
  }

  /**
   * Spawn a new NeuralMemory server process.
   */
  async start(): Promise<void> {
    if (this._running) {
      return;
    }

    const config = getConfig();
    const port = await findFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    this._log(`Starting server on port ${port}...`);

    const statusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0,
    );
    statusItem.text = "$(loading~spin) NeuralMemory: Starting...";
    statusItem.show();

    try {
      const serverEnv: Record<string, string | undefined> = {
        ...process.env,
        NEURAL_MEMORY_MODE: "extension",
        PYTHONDONTWRITEBYTECODE: "1",
      };

      this._process = cp.spawn(
        config.pythonPath,
        [
          "-m",
          "uvicorn",
          "neural_memory.server.app:create_app",
          "--factory",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          env: serverEnv,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      this._ownedProcess = true;

      // Pipe stdout/stderr to output channel
      this._process.stdout?.on("data", (data: Buffer) => {
        this._outputChannel.append(data.toString());
      });
      this._process.stderr?.on("data", (data: Buffer) => {
        this._outputChannel.append(data.toString());
      });

      // Handle unexpected exit
      this._process.on("exit", (code, signal) => {
        if (this._disposed) {
          return;
        }
        this._running = false;
        this._ownedProcess = false;
        this._removeLockFile();

        if (code !== 0 && code !== null) {
          const msg = `NeuralMemory server exited with code ${code}`;
          this._log(msg);
          this._notifyError(new Error(msg));
          this._offerRestart();
        } else if (signal) {
          this._log(`NeuralMemory server killed by signal ${signal}`);
        }
      });

      this._process.on("error", (err) => {
        this._running = false;
        this._ownedProcess = false;
        statusItem.dispose();
        this._notifyError(err);
        this._showSpawnError(err);
      });

      // Poll health until ready
      await this._waitForHealth(baseUrl);

      this._baseUrl = baseUrl;
      this._running = true;
      this._writeLockFile(port);
      this._log(`Server started successfully at ${baseUrl}`);
      this._notifyReady();
    } catch (err) {
      this._kill();
      const error =
        err instanceof Error ? err : new Error(String(err));
      this._notifyError(error);
      throw error;
    } finally {
      statusItem.dispose();
    }
  }

  /**
   * Stop the server process if this instance owns it.
   */
  async stop(): Promise<void> {
    if (!this._ownedProcess || !this._process) {
      return;
    }

    this._log("Stopping server...");
    this._kill();
    this._removeLockFile();
    this._running = false;
    this._ownedProcess = false;
    this._log("Server stopped.");
  }

  onReady(callback: ReadyCallback): vscode.Disposable {
    this._readyCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this._readyCallbacks.indexOf(callback);
      if (idx >= 0) {
        this._readyCallbacks.splice(idx, 1);
      }
    });
  }

  onError(callback: ErrorCallback): vscode.Disposable {
    this._errorCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this._errorCallbacks.indexOf(callback);
      if (idx >= 0) {
        this._errorCallbacks.splice(idx, 1);
      }
    });
  }

  dispose(): void {
    this._disposed = true;
    this.stop();
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  // -- Private helpers --

  private async _healthCheck(baseUrl: string): Promise<boolean> {
    try {
      const resp = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) {
        return false;
      }
      const data = (await resp.json()) as { status?: string };
      return data.status === "healthy";
    } catch {
      return false;
    }
  }

  private async _waitForHealth(baseUrl: string): Promise<void> {
    const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (await this._healthCheck(baseUrl)) {
        return;
      }
      // Check if process died while polling
      if (this._process?.exitCode !== null && this._process?.exitCode !== undefined) {
        throw new Error(
          `Server process exited with code ${this._process.exitCode} before becoming healthy`,
        );
      }
      await this._sleep(HEALTH_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Server did not become healthy within ${HEALTH_POLL_TIMEOUT_MS / 1000}s`,
    );
  }

  private _kill(): void {
    if (this._process && this._process.exitCode === null) {
      this._process.kill("SIGTERM");
      // Force kill after 3s if still alive
      setTimeout(() => {
        if (this._process && this._process.exitCode === null) {
          this._process.kill("SIGKILL");
        }
      }, 3000);
    }
    this._process = null;
  }

  private async _offerRestart(): Promise<void> {
    const action = await vscode.window.showErrorMessage(
      "NeuralMemory server stopped unexpectedly.",
      "Restart",
      "Show Logs",
    );

    if (action === "Restart") {
      await this.start();
    } else if (action === "Show Logs") {
      this._outputChannel.show();
    }
  }

  private _showSpawnError(err: Error): void {
    const isNotFound =
      "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";

    const message = isNotFound
      ? `Python not found at "${getConfig().pythonPath}". Install neural-memory and configure neuralmemory.pythonPath.`
      : `Failed to start NeuralMemory server: ${err.message}`;

    vscode.window.showErrorMessage(message, "Open Settings").then((action) => {
      if (action === "Open Settings") {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "neuralmemory.pythonPath",
        );
      }
    });
  }

  private _getLockFilePath(): string {
    const nmDir = path.join(os.homedir(), ".neuralmemory");
    return path.join(nmDir, LOCK_FILE_NAME);
  }

  private _readLockFile(): LockFileData | null {
    try {
      const lockPath = this._getLockFilePath();
      if (!fs.existsSync(lockPath)) {
        return null;
      }
      const content = fs.readFileSync(lockPath, "utf-8");
      return JSON.parse(content) as LockFileData;
    } catch {
      return null;
    }
  }

  private _writeLockFile(port: number): void {
    try {
      const nmDir = path.join(os.homedir(), ".neuralmemory");
      if (!fs.existsSync(nmDir)) {
        fs.mkdirSync(nmDir, { recursive: true });
      }

      const data: LockFileData = {
        pid: this._process?.pid ?? 0,
        port,
        started_at: new Date().toISOString(),
        owner: "vscode-ext",
      };

      fs.writeFileSync(this._getLockFilePath(), JSON.stringify(data, null, 2));
    } catch (err) {
      this._log(`Failed to write lock file: ${err}`);
    }
  }

  private _removeLockFile(): void {
    try {
      const lockPath = this._getLockFilePath();
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // Ignore — may have been cleaned up by another process
    }
  }

  private _notifyReady(): void {
    for (const cb of this._readyCallbacks) {
      cb();
    }
  }

  private _notifyError(err: Error): void {
    for (const cb of this._errorCallbacks) {
      cb(err);
    }
  }

  private _log(message: string): void {
    const timestamp = new Date().toISOString();
    this._outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
