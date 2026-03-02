import * as vscode from "vscode";
import { NeuralMemoryClient } from "../server/client";
import { ServerLifecycle } from "../server/lifecycle";
import type { StatsResponse } from "../server/types";

const POLL_INTERVAL_MS = 30_000;

export type ConnectionStatus = "connected" | "disconnected" | "starting";

/**
 * Manages the NeuralMemory status bar item.
 *
 * Displays: $(brain) <brainName> | N:<count> S:<count> F:<count>
 * Click opens brain switcher quick pick.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  private _disposed = false;
  private _status: ConnectionStatus = "disconnected";
  private _brainId: string | null = null;
  private _stats: StatsResponse | null = null;

  constructor(private readonly _server: ServerLifecycle) {
    this._item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this._item.command = "neuralmemory.switchBrain";
    this._item.name = "NeuralMemory";
  }

  get brainId(): string | null {
    return this._brainId;
  }

  get stats(): StatsResponse | null {
    return this._stats;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  /**
   * Show the status bar item and start polling.
   */
  show(): void {
    this._render();
    this._item.show();
    this._startPolling();
  }

  /**
   * Set connection status and re-render.
   */
  setStatus(status: ConnectionStatus): void {
    this._status = status;
    this._render();
  }

  /**
   * Set the active brain and refresh stats.
   */
  async setBrain(brainId: string): Promise<void> {
    this._brainId = brainId;
    this._render();
    await this._fetchStats();
  }

  /**
   * Refresh stats from server (called on WebSocket events or manually).
   */
  async refresh(): Promise<void> {
    await this._fetchStats();
  }

  dispose(): void {
    this._disposed = true;
    this._stopPolling();
    this._item.dispose();
  }

  // -- Private --

  private _render(): void {
    if (this._status === "starting") {
      this._item.text = "$(loading~spin) NeuralMemory";
      this._item.tooltip = "Connecting to NeuralMemory server...";
      return;
    }

    if (this._status === "disconnected") {
      this._item.text = "$(debug-disconnect) NeuralMemory";
      this._item.tooltip = "NeuralMemory: Disconnected. Click to connect.";
      this._item.command = "neuralmemory.connectServer";
      return;
    }

    // Connected
    this._item.command = "neuralmemory.switchBrain";

    const brainLabel = this._brainId ?? "no brain";

    if (this._stats) {
      const { neuron_count: n, synapse_count: s, fiber_count: f } = this._stats;
      this._item.text = `$(brain) ${brainLabel} | N:${n} S:${s} F:${f}`;
      this._item.tooltip = [
        `Brain: ${brainLabel}`,
        `Neurons: ${n}`,
        `Synapses: ${s}`,
        `Fibers: ${f}`,
        "",
        "Click to switch brain",
      ].join("\n");
    } else {
      this._item.text = `$(brain) ${brainLabel}`;
      this._item.tooltip = `Brain: ${brainLabel}\n\nClick to switch brain`;
    }
  }

  private async _fetchStats(): Promise<void> {
    if (!this._server.isRunning() || !this._brainId) {
      return;
    }

    try {
      const client = new NeuralMemoryClient(this._server.baseUrl);
      this._stats = await client.getBrainStats(this._brainId);
      this._status = "connected";
      this._render();
    } catch {
      // Server might be temporarily unavailable — don't change status
      // just skip this poll cycle
    }
  }

  private _startPolling(): void {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      if (!this._disposed) {
        this._fetchStats();
      }
    }, POLL_INTERVAL_MS);
  }

  private _stopPolling(): void {
    if (this._pollTimer !== undefined) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  }
}
