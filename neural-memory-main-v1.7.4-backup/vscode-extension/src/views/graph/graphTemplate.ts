/**
 * HTML template for the Graph Explorer webview.
 *
 * Contains CSS, the Cytoscape.js graph renderer, and
 * VS Code theme-aware styling.
 */

import * as vscode from "vscode";

export function getGraphHtml(
  webview: vscode.Webview,
  cytoscapeUri: vscode.Uri,
  nonce: string,
): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             img-src ${webview.cspSource} data:;">
  <title>NeuralMemory Graph</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    #container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    #cy {
      width: 100%;
      height: 100%;
    }

    /* --- Overlay panels --- */
    .overlay {
      position: absolute;
      background: var(--vscode-sideBar-background, rgba(30, 30, 30, 0.9));
      border: 1px solid var(--vscode-editorWidget-border, #444);
      border-radius: 4px;
      padding: 10px;
      z-index: 10;
      font-size: 12px;
    }

    /* Stats panel (top-right) */
    #stats {
      top: 10px;
      right: 10px;
      min-width: 160px;
    }

    #stats .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }

    #stats .stat-label {
      color: var(--vscode-descriptionForeground, #888);
    }

    #stats .stat-value {
      font-weight: bold;
      color: var(--vscode-editor-foreground);
    }

    #stats .truncated-notice {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--vscode-editorWidget-border, #444);
      color: var(--vscode-editorWarning-foreground, #cca700);
      font-size: 11px;
    }

    /* Legend panel (bottom-left) */
    #legend {
      bottom: 10px;
      left: 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Controls (top-left) */
    #controls {
      top: 10px;
      left: 10px;
      display: flex;
      gap: 6px;
    }

    .ctrl-btn {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ccc);
      border: 1px solid var(--vscode-editorWidget-border, #444);
      border-radius: 3px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
    }

    .ctrl-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #505254);
    }

    .ctrl-btn.primary {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }

    .ctrl-btn.primary:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    #load-more {
      display: none;
    }

    /* Loading / error */
    #status-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background);
      z-index: 100;
      font-size: 14px;
      color: var(--vscode-descriptionForeground, #888);
    }

    #status-overlay.hidden { display: none; }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--vscode-editorWidget-border, #444);
      border-top-color: var(--vscode-progressBar-background, #0e70c0);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 10px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-text { color: var(--vscode-errorForeground, #f48771); }
  </style>
</head>
<body>
  <div id="container">
    <div id="cy"></div>

    <div id="status-overlay">
      <div class="spinner"></div>
      <span>Loading graph...</span>
    </div>

    <div id="controls" class="overlay">
      <button class="ctrl-btn" id="btn-fit" title="Fit to viewport">Fit</button>
      <button class="ctrl-btn" id="btn-reset" title="Reset view (show all)">Reset</button>
      <button class="ctrl-btn primary" id="load-more">Load more</button>
    </div>

    <div id="stats" class="overlay">
      <div class="stat-row">
        <span class="stat-label">Neurons</span>
        <span class="stat-value" id="stat-neurons">—</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Synapses</span>
        <span class="stat-value" id="stat-synapses">—</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Fibers</span>
        <span class="stat-value" id="stat-fibers">—</span>
      </div>
      <div id="truncated-info" class="truncated-notice" style="display:none;"></div>
    </div>

    <div id="legend" class="overlay">
      <div class="legend-item"><span class="legend-dot" style="background:#e94560"></span>Concept</div>
      <div class="legend-item"><span class="legend-dot" style="background:#4ecdc4"></span>Entity</div>
      <div class="legend-item"><span class="legend-dot" style="background:#ffe66d"></span>Time</div>
      <div class="legend-item"><span class="legend-dot" style="background:#95e1d3"></span>Action</div>
      <div class="legend-item"><span class="legend-dot" style="background:#f38181"></span>State</div>
    </div>
  </div>

  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();

      // --- Color scheme ---
      const TYPE_COLORS = {
        concept: "#e94560",
        entity: "#4ecdc4",
        time: "#ffe66d",
        action: "#95e1d3",
        state: "#f38181",
      };

      const DEFAULT_COLOR = "#888";

      // --- Cytoscape instance ---
      let cy = null;

      function initCytoscape(elements) {
        if (cy) {
          cy.destroy();
        }

        cy = cytoscape({
          container: document.getElementById("cy"),
          elements: elements,
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                label: "data(label)",
                "font-size": "10px",
                color: getComputedStyle(document.body)
                  .getPropertyValue("--vscode-editor-foreground")
                  .trim() || "#ccc",
                "text-valign": "bottom",
                "text-margin-y": 4,
                width: "data(size)",
                height: "data(size)",
                "border-width": 1,
                "border-color": "data(borderColor)",
                "text-max-width": "80px",
                "text-wrap": "ellipsis",
                "text-overflow-wrap": "anywhere",
                "min-zoomed-font-size": 8,
              },
            },
            {
              selector: "node:selected",
              style: {
                "border-width": 3,
                "border-color": "#fff",
                "overlay-opacity": 0.1,
              },
            },
            {
              selector: "edge",
              style: {
                width: "data(weight)",
                "line-color":
                  getComputedStyle(document.body)
                    .getPropertyValue("--vscode-editorWidget-border")
                    .trim() || "#555",
                "curve-style": "bezier",
                opacity: 0.6,
                "target-arrow-shape": "data(arrow)",
                "target-arrow-color":
                  getComputedStyle(document.body)
                    .getPropertyValue("--vscode-editorWidget-border")
                    .trim() || "#555",
                "arrow-scale": 0.8,
              },
            },
          ],
          layout: {
            name: "cose",
            animate: false,
            nodeOverlap: 20,
            idealEdgeLength: 80,
            edgeElasticity: 100,
            nestingFactor: 1.2,
            gravity: 0.25,
            numIter: 1000,
            randomize: true,
            componentSpacing: 100,
            nodeDimensionsIncludeLabels: true,
          },
          minZoom: 0.1,
          maxZoom: 5,
          wheelSensitivity: 0.3,
        });

        // Click handler
        cy.on("tap", "node", function (evt) {
          const nodeId = evt.target.id();
          vscode.postMessage({ type: "nodeSelected", nodeId: nodeId });
        });

        // Double-click → recenter on neighborhood
        cy.on("dbltap", "node", function (evt) {
          const nodeId = evt.target.id();
          vscode.postMessage({ type: "recenter", nodeId: nodeId });
        });
      }

      // --- Transform server data to Cytoscape elements ---
      function toElements(data) {
        const nodes = data.neurons.map(function (n) {
          var label =
            n.content.length > 30
              ? n.content.substring(0, 27) + "..."
              : n.content;
          return {
            data: {
              id: n.id,
              label: label,
              fullContent: n.content,
              type: n.type,
              color: TYPE_COLORS[n.type] || DEFAULT_COLOR,
              borderColor: TYPE_COLORS[n.type] || DEFAULT_COLOR,
              size: 20,
            },
          };
        });

        var nodeIds = new Set(nodes.map(function (n) { return n.data.id; }));

        var edges = data.synapses
          .filter(function (s) {
            return nodeIds.has(s.source_id) && nodeIds.has(s.target_id);
          })
          .map(function (s) {
            return {
              data: {
                id: s.id,
                source: s.source_id,
                target: s.target_id,
                weight: Math.max(1, Math.min(s.weight * 3, 6)),
                arrow:
                  s.direction === "bidirectional"
                    ? "none"
                    : "triangle",
              },
            };
          });

        return nodes.concat(edges);
      }

      // --- Update stats panel ---
      function updateStats(data) {
        document.getElementById("stat-neurons").textContent =
          data.visibleNeurons;
        document.getElementById("stat-synapses").textContent =
          data.synapses.length;
        document.getElementById("stat-fibers").textContent =
          data.stats.fiber_count;

        var truncInfo = document.getElementById("truncated-info");
        var loadMoreBtn = document.getElementById("load-more");

        if (data.truncated) {
          truncInfo.style.display = "block";
          truncInfo.textContent =
            "Showing " +
            data.visibleNeurons +
            " of " +
            data.totalNeurons +
            " neurons";
          loadMoreBtn.style.display = "inline-block";
          loadMoreBtn.textContent =
            "Load more (" +
            Math.min(
              data.nodeLimit,
              data.totalNeurons - data.visibleNeurons
            ) +
            ")";
        } else {
          truncInfo.style.display = "none";
          loadMoreBtn.style.display = "none";
        }
      }

      // --- Status overlay ---
      function showStatus(msg, isError) {
        var overlay = document.getElementById("status-overlay");
        overlay.classList.remove("hidden");
        overlay.innerHTML = isError
          ? '<span class="error-text">' + escapeHtml(msg) + "</span>"
          : '<div class="spinner"></div><span>' +
            escapeHtml(msg) +
            "</span>";
      }

      function hideStatus() {
        document.getElementById("status-overlay").classList.add("hidden");
      }

      function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
      }

      // --- Button handlers ---
      document.getElementById("btn-fit").addEventListener("click", function () {
        if (cy) cy.fit(undefined, 30);
      });

      document
        .getElementById("btn-reset")
        .addEventListener("click", function () {
          vscode.postMessage({ type: "ready" });
        });

      document
        .getElementById("load-more")
        .addEventListener("click", function () {
          vscode.postMessage({ type: "loadMore" });
        });

      // --- Message handler from extension ---
      window.addEventListener("message", function (event) {
        var msg = event.data;

        switch (msg.type) {
          case "graphData":
            hideStatus();
            if (
              !msg.data ||
              !msg.data.neurons ||
              msg.data.neurons.length === 0
            ) {
              showStatus("No graph data available. Encode some memories first.", false);
              return;
            }
            var elements = toElements(msg.data);
            initCytoscape(elements);
            updateStats(msg.data);
            break;

          case "loading":
            showStatus("Loading graph...", false);
            break;

          case "error":
            showStatus(msg.error || "Unknown error", true);
            break;
        }
      });

      // --- Signal ready ---
      vscode.postMessage({ type: "ready" });
    })();
  </script>
</body>
</html>`;
}

export function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
