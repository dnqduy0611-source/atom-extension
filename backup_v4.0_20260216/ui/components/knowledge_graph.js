// ui/components/knowledge_graph.js
// Canvas-based knowledge graph visualization

(function () {
    'use strict';

    const GRAPH_CONFIG = {
        nodeRadius: 20,
        nodeColor: '#3B82F6',
        nodeHoverColor: '#1D4ED8',
        nodeSelectedColor: '#1E40AF',
        linkWidth: 2,
        fontSize: 11,
        padding: 50,
        repulsion: 100,
        attraction: 0.1,
        damping: 0.9,
        centerGravity: 0.001
    };

    const CONNECTION_COLORS = {
        supports: '#10B981',
        contradicts: '#EF4444',
        extends: '#3B82F6',
        similar: '#8B5CF6',
        applies: '#F59E0B'
    };

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + '...';
    }

    class KnowledgeGraph {
        constructor(container, data) {
            this.container = container;
            this.nodes = Array.isArray(data?.nodes) ? data.nodes : [];
            this.edges = Array.isArray(data?.edges) ? data.edges : [];

            this.canvas = null;
            this.ctx = null;
            this.width = 0;
            this.height = 0;

            this.hoveredNode = null;
            this.selectedNode = null;
            this.isDragging = false;
            this.dragNode = null;

            this.onNodeClick = null;
            this.onNodeHover = null;

            this.animationId = null;

            this.init();
        }

        init() {
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'sp-knowledge-graph-canvas';
            this.container.appendChild(this.canvas);

            this.ctx = this.canvas.getContext('2d');

            this.resize();
            this.resizeHandler = () => this.resize();
            window.addEventListener('resize', this.resizeHandler);

            this.initPositions();
            this.setupEvents();
            this.animate();
        }

        resize() {
            const rect = this.container.getBoundingClientRect();
            this.width = rect.width || 400;
            this.height = rect.height || 300;

            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = this.width * dpr;
            this.canvas.height = this.height * dpr;
            this.canvas.style.width = this.width + 'px';
            this.canvas.style.height = this.height + 'px';

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        }

        initPositions() {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const radius = Math.min(this.width, this.height) / 3;

            this.nodes.forEach((node, i) => {
                const angle = (i / this.nodes.length) * Math.PI * 2;
                node.x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
                node.y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
                node.vx = 0;
                node.vy = 0;
            });
        }

        setupEvents() {
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
            this.canvas.addEventListener('mouseup', () => this.onMouseUp());
            this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
            this.canvas.addEventListener('click', (e) => this.onClick(e));
        }

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        findNodeAtPos(pos) {
            return this.nodes.find(node => {
                const dx = node.x - pos.x;
                const dy = node.y - pos.y;
                return Math.sqrt(dx * dx + dy * dy) < GRAPH_CONFIG.nodeRadius;
            });
        }

        onMouseMove(e) {
            const pos = this.getMousePos(e);

            if (this.isDragging && this.dragNode) {
                this.dragNode.x = pos.x;
                this.dragNode.y = pos.y;
                this.dragNode.vx = 0;
                this.dragNode.vy = 0;
                return;
            }

            const node = this.findNodeAtPos(pos);
            if (node !== this.hoveredNode) {
                this.hoveredNode = node;
                this.canvas.style.cursor = node ? 'pointer' : 'default';
                if (typeof this.onNodeHover === 'function') {
                    this.onNodeHover(node);
                }
            }
        }

        onMouseDown(e) {
            const pos = this.getMousePos(e);
            const node = this.findNodeAtPos(pos);

            if (node) {
                this.isDragging = true;
                this.dragNode = node;
            }
        }

        onMouseUp() {
            this.isDragging = false;
            this.dragNode = null;
        }

        onClick(e) {
            const pos = this.getMousePos(e);
            const node = this.findNodeAtPos(pos);

            if (node) {
                this.selectedNode = node;
                if (typeof this.onNodeClick === 'function') {
                    this.onNodeClick(node);
                }
            } else {
                this.selectedNode = null;
            }
        }

        simulate() {
            this.nodes.forEach(node => {
                if (node === this.dragNode) return;

                // Repulsion from other nodes
                this.nodes.forEach(other => {
                    if (node === other) return;

                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                    if (dist < GRAPH_CONFIG.repulsion * 2) {
                        const force = GRAPH_CONFIG.repulsion / (dist * dist);
                        node.vx += (dx / dist) * force;
                        node.vy += (dy / dist) * force;
                    }
                });

                // Attraction along edges
                this.edges.forEach(edge => {
                    let other = null;
                    if (edge.source === node.id) {
                        other = this.nodes.find(n => n.id === edge.target);
                    } else if (edge.target === node.id) {
                        other = this.nodes.find(n => n.id === edge.source);
                    }

                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        node.vx += dx * GRAPH_CONFIG.attraction;
                        node.vy += dy * GRAPH_CONFIG.attraction;
                    }
                });

                // Center gravity
                const dx = this.width / 2 - node.x;
                const dy = this.height / 2 - node.y;
                node.vx += dx * GRAPH_CONFIG.centerGravity;
                node.vy += dy * GRAPH_CONFIG.centerGravity;

                // Apply damping
                node.vx *= GRAPH_CONFIG.damping;
                node.vy *= GRAPH_CONFIG.damping;

                // Update position
                node.x += node.vx;
                node.y += node.vy;

                // Bounds
                node.x = Math.max(GRAPH_CONFIG.padding, Math.min(this.width - GRAPH_CONFIG.padding, node.x));
                node.y = Math.max(GRAPH_CONFIG.padding, Math.min(this.height - GRAPH_CONFIG.padding, node.y));
            });
        }

        draw() {
            this.ctx.clearRect(0, 0, this.width, this.height);

            // Draw edges
            this.edges.forEach(edge => {
                const source = this.nodes.find(n => n.id === edge.source);
                const target = this.nodes.find(n => n.id === edge.target);

                if (!source || !target) return;

                const color = CONNECTION_COLORS[edge.type?.toLowerCase()] || CONNECTION_COLORS.similar;

                this.ctx.beginPath();
                this.ctx.moveTo(source.x, source.y);
                this.ctx.lineTo(target.x, target.y);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = GRAPH_CONFIG.linkWidth;
                this.ctx.stroke();
            });

            // Draw nodes
            this.nodes.forEach(node => {
                const isHovered = node === this.hoveredNode;
                const isSelected = node === this.selectedNode;

                // Node circle
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, GRAPH_CONFIG.nodeRadius, 0, Math.PI * 2);

                if (isSelected) {
                    this.ctx.fillStyle = GRAPH_CONFIG.nodeSelectedColor;
                } else if (isHovered) {
                    this.ctx.fillStyle = GRAPH_CONFIG.nodeHoverColor;
                } else {
                    this.ctx.fillStyle = GRAPH_CONFIG.nodeColor;
                }

                this.ctx.fill();

                if (isSelected) {
                    this.ctx.strokeStyle = '#1E40AF';
                    this.ctx.lineWidth = 3;
                    this.ctx.stroke();
                }

                // Node label
                this.ctx.fillStyle = '#1F2937';
                this.ctx.font = `${GRAPH_CONFIG.fontSize}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    truncateText(node.label, 15),
                    node.x,
                    node.y + GRAPH_CONFIG.nodeRadius + 15
                );
            });
        }

        animate() {
            this.simulate();
            this.draw();
            this.animationId = requestAnimationFrame(() => this.animate());
        }

        destroy() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            window.removeEventListener('resize', this.resizeHandler);
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.remove();
            }
        }

        updateData(newNodes, newEdges) {
            this.nodes = Array.isArray(newNodes) ? newNodes : [];
            this.edges = Array.isArray(newEdges) ? newEdges : [];
            this.initPositions();
        }
    }

    /**
     * Creates knowledge graph UI wrapper.
     */
    function createKnowledgeGraphUI(data, strings, onNodeSelect) {
        const labels = strings || {};
        const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
        const edges = Array.isArray(data?.edges) ? data.edges : [];

        const container = document.createElement('div');
        container.className = 'sp-knowledge-graph';

        container.innerHTML = `
            <div class="sp-graph-header">
                <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                    ${labels.title || 'Your Knowledge Map'}
                </h3>
                <div class="sp-graph-controls">
                    <select class="sp-graph-filter" id="sp-graph-filter">
                        <option value="all">${labels.filterAll || 'All Topics'}</option>
                        <option value="recent">${labels.filterRecent || 'Recent (7 days)'}</option>
                        <option value="connected">${labels.filterConnected || 'Most Connected'}</option>
                    </select>
                    <button type="button" class="sp-graph-btn" id="sp-graph-reset">${labels.reset || 'Reset View'}</button>
                </div>
            </div>

            <div class="sp-graph-canvas-container"></div>

            <div class="sp-graph-legend">
                <span class="sp-graph-legend-item">
                    <span class="sp-graph-legend-color" style="background: #10B981"></span>
                    ${labels.supports || 'Supports'}
                </span>
                <span class="sp-graph-legend-item">
                    <span class="sp-graph-legend-color" style="background: #EF4444"></span>
                    ${labels.contradicts || 'Contradicts'}
                </span>
                <span class="sp-graph-legend-item">
                    <span class="sp-graph-legend-color" style="background: #3B82F6"></span>
                    ${labels.extends || 'Extends'}
                </span>
                <span class="sp-graph-legend-item">
                    <span class="sp-graph-legend-color" style="background: #8B5CF6"></span>
                    ${labels.similar || 'Similar'}
                </span>
                <span class="sp-graph-legend-item">
                    <span class="sp-graph-legend-color" style="background: #F59E0B"></span>
                    ${labels.applies || 'Applies'}
                </span>
            </div>

            <div class="sp-graph-details" id="sp-graph-details" style="display: none;">
                <div class="sp-graph-details-header">
                    <span id="sp-graph-details-title"></span>
                    <button type="button" class="sp-graph-details-close">×</button>
                </div>
                <div class="sp-graph-details-content">
                    <div id="sp-graph-details-meta"></div>
                    <div id="sp-graph-details-connections"></div>
                    <button type="button" class="sp-graph-btn-primary" id="sp-graph-view-session">
                        ${labels.viewSession || 'View Full Session'}
                    </button>
                </div>
            </div>
        `;

        let graph = null;

        // Initialize graph after container is in DOM
        setTimeout(() => {
            const canvasContainer = container.querySelector('.sp-graph-canvas-container');
            if (!canvasContainer) return;

            graph = new KnowledgeGraph(canvasContainer, { nodes, edges });

            graph.onNodeClick = (node) => {
                showNodeDetails(container, node, edges);
                if (typeof onNodeSelect === 'function') {
                    onNodeSelect(node);
                }
            };

            // Reset button
            container.querySelector('#sp-graph-reset')?.addEventListener('click', () => {
                if (graph) graph.initPositions();
            });

            // Close details
            container.querySelector('.sp-graph-details-close')?.addEventListener('click', () => {
                container.querySelector('#sp-graph-details').style.display = 'none';
            });

            // View session button
            container.querySelector('#sp-graph-view-session')?.addEventListener('click', () => {
                if (graph?.selectedNode && typeof onNodeSelect === 'function') {
                    onNodeSelect(graph.selectedNode);
                }
            });
        }, 0);

        // Cleanup method
        container.destroy = () => {
            if (graph) graph.destroy();
        };

        return container;
    }

    function showNodeDetails(container, node, edges) {
        const details = container.querySelector('#sp-graph-details');
        if (!details || !node) return;

        const connections = edges.filter(e =>
            e.source === node.id || e.target === node.id
        );

        details.querySelector('#sp-graph-details-title').textContent = node.label || 'Unknown';
        details.querySelector('#sp-graph-details-meta').innerHTML = `
            <div>Created: ${node.createdAt ? new Date(node.createdAt).toLocaleDateString() : 'Unknown'}</div>
            <div>Connections: ${connections.length}</div>
        `;

        const connectionsHtml = connections.length > 0
            ? connections.map(c => {
                const color = CONNECTION_COLORS[c.type?.toLowerCase()] || CONNECTION_COLORS.similar;
                const icon = getConnectionIcon(c.type);
                return `<span class="sp-graph-connection-badge" style="background: ${color}">${icon} ${c.type || 'Similar'}</span>`;
            }).join('')
            : '<em>No connections yet</em>';

        details.querySelector('#sp-graph-details-connections').innerHTML = connectionsHtml;
        details.style.display = 'block';
    }

    function getConnectionIcon(type) {
        // Simple SVGs for connection types
        const icons = {
            supports: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`, // Check circle
            contradicts: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, // Alert triangle
            extends: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`, // Plus circle
            similar: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`, // Refresh/Cycle
            applies: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>` // Wrench
        };
        return icons[type?.toLowerCase()] || icons.similar;
    }

    // CSS Styles
    const KNOWLEDGE_GRAPH_STYLES = `
.sp-knowledge-graph {
    height: 450px;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
}

.sp-graph-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.sp-graph-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.sp-graph-controls {
    display: flex;
    gap: 8px;
}

.sp-graph-filter, .sp-graph-btn {
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    cursor: pointer;
}

.sp-graph-btn:hover {
    background: #f3f4f6;
}

.sp-graph-canvas-container {
    flex: 1;
    position: relative;
    min-height: 200px;
}

.sp-knowledge-graph-canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.sp-graph-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 16px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
}

.sp-graph-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sp-graph-legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.sp-graph-details {
    position: absolute;
    top: 60px;
    right: 16px;
    width: 220px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10;
}

.sp-graph-details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    font-size: 14px;
}

.sp-graph-details-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #6b7280;
}

.sp-graph-details-content {
    padding: 12px;
    font-size: 13px;
}

.sp-graph-details-content > div {
    margin-bottom: 8px;
}

.sp-graph-connection-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: white;
    margin: 2px 2px 2px 0;
}

.sp-graph-btn-primary {
    width: 100%;
    padding: 8px;
    background: #3B82F6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    margin-top: 8px;
}

.sp-graph-btn-primary:hover {
    background: #2563EB;
}

/* Dark mode */
body.dark-mode .sp-knowledge-graph,
.dark .sp-knowledge-graph {
    background: #1f2937;
}

body.dark-mode .sp-graph-header,
.dark .sp-graph-header {
    border-color: #374151;
}

body.dark-mode .sp-graph-header h3,
.dark .sp-graph-header h3 {
    color: #f3f4f6;
}

body.dark-mode .sp-graph-filter,
body.dark-mode .sp-graph-btn,
.dark .sp-graph-filter,
.dark .sp-graph-btn {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
}

body.dark-mode .sp-graph-legend,
.dark .sp-graph-legend {
    background: #111827;
    border-color: #374151;
    color: #9ca3af;
}

body.dark-mode .sp-graph-details,
.dark .sp-graph-details {
    background: #1f2937;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

body.dark-mode .sp-graph-details-header,
.dark .sp-graph-details-header {
    border-color: #374151;
    color: #f3f4f6;
}

body.dark-mode .sp-graph-details-content,
.dark .sp-graph-details-content {
    color: #d1d5db;
}
`;

    function injectKnowledgeGraphStyles() {
        if (document.getElementById('knowledge-graph-styles')) return;
        const style = document.createElement('style');
        style.id = 'knowledge-graph-styles';
        style.textContent = KNOWLEDGE_GRAPH_STYLES;
        document.head.appendChild(style);
    }

    window.KnowledgeGraphUI = {
        KnowledgeGraph,
        createKnowledgeGraphUI,
        injectKnowledgeGraphStyles
    };
})();
