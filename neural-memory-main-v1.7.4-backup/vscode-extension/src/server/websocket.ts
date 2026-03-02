/**
 * WebSocket client for real-time sync with the NeuralMemory server.
 *
 * Protocol (matches server/routes/sync.py):
 *   1. Connect → send {"action": "connect", "client_id": "..."}
 *   2. Server responds {"type": "connected", ...}
 *   3. Subscribe → send {"action": "subscribe", "brain_id": "..."}
 *   4. Receive broadcast events as they occur
 *   5. Ping/pong keepalive
 */

import * as vscode from "vscode";
import WebSocket from "ws";
import type { SyncEvent } from "./types";

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL_MS = 30_000;

type EventHandler = (event: SyncEvent) => void;

export class SyncClient implements vscode.Disposable {
  private _ws: WebSocket | null = null;
  private _clientId: string;
  private _connected = false;
  private _disposed = false;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private _pingTimer: ReturnType<typeof setInterval> | undefined;
  private _subscribedBrains = new Set<string>();

  private readonly _handlers: EventHandler[] = [];

  constructor(private readonly _serverBaseUrl: string) {
    this._clientId = `vscode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  /**
   * Register a handler for all incoming sync events.
   */
  onEvent(handler: EventHandler): vscode.Disposable {
    this._handlers.push(handler);
    return new vscode.Disposable(() => {
      const idx = this._handlers.indexOf(handler);
      if (idx >= 0) {
        this._handlers.splice(idx, 1);
      }
    });
  }

  /**
   * Connect to the WebSocket endpoint and send the connect handshake.
   */
  async connect(): Promise<void> {
    if (this._disposed) {
      return;
    }

    const wsUrl = this._toWsUrl(this._serverBaseUrl);

    return new Promise<void>((resolve, reject) => {
      try {
        this._ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      const connectTimeout = setTimeout(() => {
        reject(new Error("WebSocket connect timeout"));
        this._ws?.terminate();
      }, 10_000);

      this._ws.on("open", () => {
        clearTimeout(connectTimeout);
        // Send connect handshake
        this._send({
          action: "connect",
          client_id: this._clientId,
        });
      });

      this._ws.on("message", (data: WebSocket.Data) => {
        const message = this._parseMessage(data);
        if (!message) {
          return;
        }

        // Handle connect response
        if (message.type === "connected") {
          this._connected = true;
          this._reconnectAttempts = 0;
          this._startPing();

          // Re-subscribe to any brains from before reconnect
          for (const brainId of this._subscribedBrains) {
            this._send({ action: "subscribe", brain_id: brainId });
          }

          resolve();
          return;
        }

        // Handle pong (keepalive ack, ignore)
        if (message.type === "pong") {
          return;
        }

        // Handle subscribed/unsubscribed confirmations (ignore)
        if (message.type === "subscribed" || message.type === "unsubscribed") {
          return;
        }

        // Broadcast to registered handlers
        this._emit(message as unknown as SyncEvent);
      });

      this._ws.on("close", () => {
        clearTimeout(connectTimeout);
        this._connected = false;
        this._stopPing();

        if (!this._disposed) {
          this._scheduleReconnect();
        }
      });

      this._ws.on("error", (err) => {
        clearTimeout(connectTimeout);
        this._connected = false;

        // Only reject on initial connect, not on reconnect
        if (this._reconnectAttempts === 0) {
          reject(err);
        }

        if (!this._disposed) {
          this._scheduleReconnect();
        }
      });
    });
  }

  /**
   * Subscribe to events for a specific brain.
   */
  subscribe(brainId: string): void {
    this._subscribedBrains.add(brainId);
    if (this._connected) {
      this._send({ action: "subscribe", brain_id: brainId });
    }
  }

  /**
   * Unsubscribe from events for a specific brain.
   */
  unsubscribe(brainId: string): void {
    this._subscribedBrains.delete(brainId);
    if (this._connected) {
      this._send({ action: "unsubscribe", brain_id: brainId });
    }
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    this._stopPing();
    this._clearReconnect();

    if (this._ws) {
      this._ws.removeAllListeners();
      if (this._ws.readyState === WebSocket.OPEN) {
        this._ws.close(1000, "client disconnect");
      } else {
        this._ws.terminate();
      }
      this._ws = null;
    }

    this._connected = false;
  }

  dispose(): void {
    this._disposed = true;
    this.disconnect();
  }

  // ── Private helpers ────────────────────────────────────────

  private _send(data: Record<string, unknown>): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  private _parseMessage(
    data: WebSocket.Data,
  ): Record<string, unknown> | null {
    try {
      const text = typeof data === "string" ? data : data.toString();
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private _emit(event: SyncEvent): void {
    for (const handler of this._handlers) {
      try {
        handler(event);
      } catch {
        // Don't let one handler break others
      }
    }
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      this._send({ action: "ping" });
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this._pingTimer !== undefined) {
      clearInterval(this._pingTimer);
      this._pingTimer = undefined;
    }
  }

  private _scheduleReconnect(): void {
    this._clearReconnect();

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this._reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this._reconnectAttempts;

    this._reconnectTimer = setTimeout(async () => {
      if (this._disposed) {
        return;
      }
      try {
        await this.connect();
      } catch {
        // connect() will schedule another reconnect via the close/error handlers
      }
    }, delay);
  }

  private _clearReconnect(): void {
    if (this._reconnectTimer !== undefined) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
  }

  /**
   * Convert HTTP base URL to WebSocket URL.
   * http://127.0.0.1:8000 → ws://127.0.0.1:8000/sync/ws
   */
  private _toWsUrl(baseUrl: string): string {
    return baseUrl
      .replace(/^https:/, "wss:")
      .replace(/^http:/, "ws:")
      .replace(/\/$/, "") + "/sync/ws";
  }
}
