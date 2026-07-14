import { AnimatePresence, motion } from "framer-motion";
import { Brain, Database, Network, PanelRightOpen, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GraphControls from "./GraphControls";
import type { GraphPanelMode, LegendPanelMode } from "./GraphControls";
import GraphLegend from "./GraphLegend";
import GraphNodeDetails from "./GraphNodeDetails";
import GraphSearch from "./GraphSearch";
import GraphView from "./GraphView";
import type { GraphCanvasApi } from "./GraphView";
import type { GraphEntityKind, KnowledgeGraphLink, KnowledgeGraphNode, NormalizedGraph } from "./graphUtils";
import {
  NODE_TYPE_ORDER,
  getConnectedLinks,
  getConnectedNodeIds,
  getEndpointId,
  graphSearchText,
  normalizeGraphData,
} from "./graphUtils";

interface GraphVisualizerProps {
  graphData: unknown;
  isLoading?: boolean;
  panelMode: GraphPanelMode;
  onPanelModeChange: (mode: GraphPanelMode) => void;
}

const GRAPH_LEGEND_MODE_KEY = "advisor_graph_legend_mode";
const GRAPH_INSPECTOR_COLLAPSED_KEY = "advisor_graph_inspector_collapsed";
const GRAPH_INSPECTOR_PINNED_KEY = "advisor_graph_inspector_pinned";
const GRAPH_INSPECTOR_AUTO_HIDE_KEY = "advisor_graph_inspector_auto_hide";

function getStoredBoolean(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === "true";
}

function getStoredLegendMode(): LegendPanelMode {
  const raw = localStorage.getItem(GRAPH_LEGEND_MODE_KEY);
  return raw === "expanded" || raw === "compact" || raw === "collapsed" ? raw : "expanded";
}

function visibleTypeSet(graph: NormalizedGraph): Set<GraphEntityKind> {
  const visibleTypes = NODE_TYPE_ORDER.filter((type) => graph.typeCounts[type] > 0);
  return new Set(visibleTypes.length > 0 ? visibleTypes : NODE_TYPE_ORDER);
}

function buildCollapsedHiddenNodes(
  links: KnowledgeGraphLink[],
  collapsedNodeIds: Set<string>,
  selectedNodeId: string | null,
): Set<string> {
  const hidden = new Set<string>();

  for (const collapsedId of collapsedNodeIds) {
    for (const link of links) {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      if (source !== collapsedId && target !== collapsedId) continue;

      const neighbor = source === collapsedId ? target : source;
      if (neighbor !== selectedNodeId) hidden.add(neighbor);
    }
  }

  return hidden;
}

function buildVisibleGraph(
  graph: NormalizedGraph,
  enabledTypes: Set<GraphEntityKind>,
  searchMatches: KnowledgeGraphNode[],
  collapsedNodeIds: Set<string>,
  selectedNodeId: string | null,
): NormalizedGraph {
  const hiddenNodes = buildCollapsedHiddenNodes(graph.links, collapsedNodeIds, selectedNodeId);
  const searchScope = new Set<string>();

  if (searchMatches.length > 0) {
    for (const node of searchMatches) {
      searchScope.add(node.id);
      for (const linkedId of getConnectedNodeIds(graph.links, node.id)) {
        searchScope.add(linkedId);
      }
    }
  }

  const nodes = graph.nodes.filter((node) => {
    if (!enabledTypes.has(node.type)) return false;
    if (hiddenNodes.has(node.id)) return false;
    if (searchScope.size > 0 && !searchScope.has(node.id)) return false;
    return true;
  });
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const links = graph.links.filter((link) => {
    const source = getEndpointId(link.source);
    const target = getEndpointId(link.target);
    return visibleNodeIds.has(source) && visibleNodeIds.has(target);
  });

  return {
    ...graph,
    nodes,
    links,
  };
}

function buildHighlights({
  graph,
  selectedNodeId,
  hoveredNodeId,
  hoveredLinkId,
  activeRelationship,
  searchMatches,
}: {
  graph: NormalizedGraph;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredLinkId: string | null;
  activeRelationship: string | null;
  searchMatches: KnowledgeGraphNode[];
}) {
  const nodeIds = new Set<string>();
  const linkIds = new Set<string>();

  const addNodeNeighborhood = (nodeId: string) => {
    nodeIds.add(nodeId);
    for (const link of graph.links) {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      if (source !== nodeId && target !== nodeId) continue;
      linkIds.add(link.id);
      nodeIds.add(source);
      nodeIds.add(target);
    }
  };

  if (selectedNodeId) addNodeNeighborhood(selectedNodeId);
  if (hoveredNodeId) addNodeNeighborhood(hoveredNodeId);

  if (hoveredLinkId) {
    const link = graph.links.find((item) => item.id === hoveredLinkId);
    if (link) {
      linkIds.add(link.id);
      nodeIds.add(getEndpointId(link.source));
      nodeIds.add(getEndpointId(link.target));
    }
  }

  if (activeRelationship) {
    for (const link of graph.links) {
      if (link.type !== activeRelationship) continue;
      linkIds.add(link.id);
      nodeIds.add(getEndpointId(link.source));
      nodeIds.add(getEndpointId(link.target));
    }
  }

  for (const node of searchMatches) {
    addNodeNeighborhood(node.id);
  }

  return { nodeIds, linkIds };
}

function EmptyGraphState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex min-h-[460px] flex-1 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center shadow-xl shadow-slate-900/5 dark:border-white/15 dark:bg-white/5"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
          <Network className={`h-7 w-7 ${isLoading ? "animate-pulse" : ""}`} aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
          {isLoading ? "Preparing graph evidence" : "No graph evidence returned"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          The explorer is ready for Neo4j node-link payloads from the advisor response.
        </p>
        {isLoading && (
          <div className="mt-5 space-y-2">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="mx-auto h-2 w-2/3 rounded-full bg-slate-200 dark:bg-white/10" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function GraphVisualizer({
  graphData,
  isLoading = false,
  panelMode,
  onPanelModeChange,
}: GraphVisualizerProps) {
  const graphRef = useRef<GraphCanvasApi | undefined>(undefined);
  const graph = useMemo(() => normalizeGraphData(graphData), [graphData]);
  const [enabledTypes, setEnabledTypes] = useState<Set<GraphEntityKind>>(() => visibleTypeSet(graph));
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [activeRelationship, setActiveRelationship] = useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [legendMode, setLegendMode] = useState<LegendPanelMode>(() => getStoredLegendMode());
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() =>
    getStoredBoolean(GRAPH_INSPECTOR_COLLAPSED_KEY, false)
  );
  const [inspectorPinned, setInspectorPinned] = useState(() =>
    getStoredBoolean(GRAPH_INSPECTOR_PINNED_KEY, true)
  );
  const [autoHideInspector, setAutoHideInspector] = useState(() =>
    getStoredBoolean(GRAPH_INSPECTOR_AUTO_HIDE_KEY, true)
  );
  const [focusVersion, setFocusVersion] = useState(0);

  const hasGraph = graph.nodes.length > 0;
  const graphTitle = graph.title || "Neo4j Graph Intelligence";
  const graphSubtitle = graph.subtitle || "Explainable academic entities, roles, pathways, and governance links";
  const cypherBadgeLabel = graph.badge || "Cypher Verified";
  const effectiveInspectorCollapsed = inspectorCollapsed || (fullscreen && autoHideInspector && !inspectorPinned);
  const hasSideRail = legendMode !== "collapsed" || !effectiveInspectorCollapsed;
  const sideRailStacked = hasSideRail && !fullscreen && panelMode !== "expanded";
  const sideRailClass = hasSideRail
    ? fullscreen
      ? "xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
      : panelMode === "expanded"
        ? "2xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]"
        : "grid-cols-1"
    : fullscreen
      ? "xl:grid-cols-1"
      : "2xl:grid-cols-1";
  const bodyOverflowClass = sideRailStacked ? "custom-scrollbar overflow-y-auto" : "overflow-hidden";
  const sideRailLayoutClass = sideRailStacked
    ? "grid-cols-1 lg:grid-cols-2"
    : legendMode === "collapsed" || effectiveInspectorCollapsed
      ? "2xl:grid-rows-1"
      : "2xl:grid-rows-[minmax(0,0.82fr)_minmax(0,1.3fr)]";
  const toolbarGridClass = fullscreen || panelMode === "expanded"
    ? "xl:grid-cols-[minmax(260px,1fr)_auto]"
    : "grid-cols-1";

  useEffect(() => {
    localStorage.setItem(GRAPH_LEGEND_MODE_KEY, legendMode);
    localStorage.setItem(GRAPH_INSPECTOR_COLLAPSED_KEY, String(inspectorCollapsed));
    localStorage.setItem(GRAPH_INSPECTOR_PINNED_KEY, String(inspectorPinned));
    localStorage.setItem(GRAPH_INSPECTOR_AUTO_HIDE_KEY, String(autoHideInspector));
  }, [autoHideInspector, inspectorCollapsed, inspectorPinned, legendMode]);

  useEffect(() => {
    if (!fullscreen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setEnabledTypes(visibleTypeSet(graph));
      setCollapsedNodeIds(new Set());
      setActiveRelationship(null);
      setHoveredNodeId(null);
      setHoveredLinkId(null);
      setQuery("");
      setFullscreen(false);
      setSelectedNodeId(graph.primaryNodeId);
      setFocusVersion((version) => version + 1);
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [graph]);

  const searchMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return graph.nodes
      .filter((node) => graphSearchText(node).includes(normalizedQuery))
      .sort((left, right) => right.degree - left.degree)
      .slice(0, 16);
  }, [graph.nodes, query]);

  const visibleGraph = useMemo(
    () => buildVisibleGraph(graph, enabledTypes, searchMatches, collapsedNodeIds, selectedNodeId),
    [collapsedNodeIds, enabledTypes, graph, searchMatches, selectedNodeId],
  );

  const highlighted = useMemo(
    () =>
      buildHighlights({
        graph,
        selectedNodeId,
        hoveredNodeId,
        hoveredLinkId,
        activeRelationship,
        searchMatches,
      }),
    [activeRelationship, graph, hoveredLinkId, hoveredNodeId, searchMatches, selectedNodeId],
  );

  const selectedNode = selectedNodeId ? graph.nodeMap.get(selectedNodeId) || null : null;
  const connectedLinks = selectedNode ? getConnectedLinks(graph.links, selectedNode.id) : [];

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = graph.nodeMap.get(nodeId);
      if (!node) return;

      setEnabledTypes((current) => {
        const next = new Set(current);
        next.add(node.type);
        return next;
      });
      setSelectedNodeId(nodeId);
      setCollapsedNodeIds((current) => {
        if (!current.has(nodeId)) return current;
        const next = new Set(current);
        next.delete(nodeId);
        return next;
      });
      setFocusVersion((version) => version + 1);
    },
    [graph.nodeMap],
  );

  const fitGraph = useCallback(() => {
    graphRef.current?.zoomToFit(650, fullscreen ? 80 : 48);
  }, [fullscreen]);

  useEffect(() => {
    if (!hasGraph) return undefined;

    const timer = window.setTimeout(() => {
      fitGraph();
    }, fullscreen ? 180 : 120);

    return () => window.clearTimeout(timer);
  }, [fitGraph, fullscreen, hasGraph, panelMode]);

  const resetView = useCallback(() => {
    setEnabledTypes(visibleTypeSet(graph));
    setQuery("");
    setCollapsedNodeIds(new Set());
    setActiveRelationship(null);
    setHoveredNodeId(null);
    setHoveredLinkId(null);
    setSelectedNodeId(graph.primaryNodeId);
    setFocusVersion((version) => version + 1);
    window.setTimeout(fitGraph, 60);
  }, [fitGraph, graph]);

  const resetLayout = useCallback(() => {
    setLegendMode("expanded");
    setInspectorCollapsed(false);
    setInspectorPinned(true);
    setAutoHideInspector(true);
    onPanelModeChange("balanced");
    resetView();
  }, [onPanelModeChange, resetView]);

  useEffect(() => {
    const showGraph = () => {
      if (graph.primaryNodeId) focusNode(graph.primaryNodeId);
      setCollapsedNodeIds(new Set());
      window.setTimeout(fitGraph, 80);
    };

    window.addEventListener("aast-show-graph", showGraph);
    return () => window.removeEventListener("aast-show-graph", showGraph);
  }, [fitGraph, focusNode, graph.primaryNodeId]);

  const toggleType = (type: GraphEntityKind) => {
    setEnabledTypes((current) => {
      const next = new Set(current);
      if (next.has(type) && next.size > 1) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const resetTypes = () => {
    setEnabledTypes(visibleTypeSet(graph));
  };

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const zoomBy = (factor: number) => {
    const currentZoom = graphRef.current?.zoom() || 1;
    graphRef.current?.zoom(Math.max(0.18, Math.min(5, currentZoom * factor)), 220);
  };

  const toggleLegendMode = () => {
    setLegendMode((current) => {
      if (current === "expanded") return "compact";
      if (current === "compact") return "collapsed";
      return "expanded";
    });
  };

  return (
    <motion.section
      layout
      className={`${
        fullscreen
          ? "fixed inset-2 z-50 min-h-0 sm:inset-4"
          : "relative h-full min-h-0 w-full"
      } flex min-w-0 overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-2xl shadow-slate-950/20 ${
        graph.isDemo ? "border-cyan-300/20 ring-1 ring-purple-300/10" : "border-white/10"
      }`}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-col">
        <header className={`border-b px-4 py-3 text-white ${
          graph.isDemo ? "border-cyan-300/15 bg-slate-950/98" : "border-white/10 bg-slate-950/96"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 shadow-lg ${
                graph.isDemo
                  ? "bg-purple-500/15 text-purple-100 ring-purple-200/25 shadow-purple-950/30"
                  : "bg-blue-500/15 text-blue-200 ring-blue-300/20 shadow-blue-950/30"
              }`}>
                <Brain className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-bold uppercase tracking-[0.14em] text-white">
                    {graphTitle}
                  </h2>
                  <Sparkles className="h-4 w-4 text-gold-400" aria-hidden="true" />
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {graphSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {graph.isDemo && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100 ring-1 ring-purple-300/25">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Demo showcase
                  </span>
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/20">
                    AI Academic Advisor
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
                {graph.nodes.length} entities
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                {graph.links.length} relationships
              </span>
              {visibleGraph.nodes.length !== graph.nodes.length && (
                <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100 ring-1 ring-blue-300/20">
                  {visibleGraph.nodes.length} visible
                </span>
              )}
              {(graph.cypherQuery || graph.isDemo) && (
                <span className="max-w-[220px] truncate rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/20">
                  {cypherBadgeLabel}
                </span>
              )}
            </div>
          </div>
        </header>

        {!hasGraph ? (
          <EmptyGraphState isLoading={isLoading} />
        ) : (
          <div className={`grid min-h-0 min-w-0 flex-1 gap-3 bg-slate-950 p-3 ${sideRailClass} ${bodyOverflowClass}`}>
            <main className="flex min-h-0 min-w-0 flex-col gap-3">
              <div className={`grid items-start gap-3 ${toolbarGridClass}`}>
                <GraphSearch
                  query={query}
                  matches={searchMatches}
                  onQueryChange={setQuery}
                  onSelectNode={focusNode}
                  onClear={() => setQuery("")}
                />
                <GraphControls
                  showLabels={showLabels}
                  physicsEnabled={physicsEnabled}
                  fullscreen={fullscreen}
                  panelMode={panelMode}
                  legendMode={legendMode}
                  inspectorCollapsed={effectiveInspectorCollapsed}
                  inspectorPinned={inspectorPinned}
                  autoHideInspector={autoHideInspector}
                  onZoomIn={() => zoomBy(1.25)}
                  onZoomOut={() => zoomBy(0.8)}
                  onFit={fitGraph}
                  onReset={resetLayout}
                  onToggleLabels={() => setShowLabels((value) => !value)}
                  onTogglePhysics={() => setPhysicsEnabled((value) => !value)}
                  onToggleFullscreen={() => setFullscreen((value) => !value)}
                  onPanelModeChange={onPanelModeChange}
                  onToggleLegend={toggleLegendMode}
                  onToggleInspector={() => setInspectorCollapsed((value) => !value)}
                  onToggleInspectorPin={() => setInspectorPinned((value) => !value)}
                  onToggleAutoHideInspector={() => setAutoHideInspector((value) => !value)}
                />
              </div>

              {graph.isDemo && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-3 rounded-xl border border-cyan-300/15 bg-white/[0.055] p-3 shadow-lg shadow-cyan-950/20 backdrop-blur md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
                        <Network className="h-3.5 w-3.5" aria-hidden="true" />
                        Graph evidence loaded
                      </span>
                      <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                        {Object.keys(graph.relationshipCounts).length} relationship types
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-200">
                      AAST AI Program, majors, subjects, leadership, establishment year, and degree metadata are ready for inspection.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (graph.primaryNodeId) focusNode(graph.primaryNodeId);
                      window.setTimeout(fitGraph, 40);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
                  >
                    <Network className="h-4 w-4" aria-hidden="true" />
                    Open graph evidence
                  </button>
                </motion.div>
              )}

              <GraphView
                graph={visibleGraph}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredNodeId}
                hoveredLinkId={hoveredLinkId}
                activeRelationship={activeRelationship}
                highlightedNodeIds={highlighted.nodeIds}
                highlightedLinkIds={highlighted.linkIds}
                showLabels={showLabels}
                physicsEnabled={physicsEnabled}
                focusVersion={focusVersion}
                graphRef={graphRef}
                onNodeSelect={focusNode}
                onNodeHover={setHoveredNodeId}
                onLinkHover={setHoveredLinkId}
              />
            </main>

            <AnimatePresence initial={false}>
              {hasSideRail && (
                <motion.div
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.2 }}
                  className={`grid min-h-0 min-w-0 gap-3 ${sideRailLayoutClass}`}
                >
                  {legendMode !== "collapsed" && (
                    <GraphLegend
                      mode={legendMode}
                      typeCounts={graph.typeCounts}
                      relationshipCounts={graph.relationshipCounts}
                      enabledTypes={enabledTypes}
                      activeRelationship={activeRelationship}
                      onModeChange={setLegendMode}
                      onToggleType={toggleType}
                      onResetTypes={resetTypes}
                      onRelationshipFocus={setActiveRelationship}
                    />
                  )}

                  {!effectiveInspectorCollapsed && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedNode?.id || "empty-details"}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.16 }}
                        className="min-h-[360px] 2xl:min-h-0"
                      >
                        <GraphNodeDetails
                          node={selectedNode}
                          connectedLinks={connectedLinks}
                          nodeMap={graph.nodeMap}
                          isCollapsed={!!selectedNode && collapsedNodeIds.has(selectedNode.id)}
                          pinned={inspectorPinned}
                          autoHidden={fullscreen && autoHideInspector && !inspectorPinned}
                          onClose={() => setInspectorCollapsed(true)}
                          onFocusNode={focusNode}
                          onToggleCollapse={toggleCollapse}
                          onTogglePin={() => setInspectorPinned((value) => !value)}
                        />
                      </motion.div>
                    </AnimatePresence>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {fullscreen && (
        <button
          type="button"
          className="fixed inset-0 -z-10 cursor-default bg-slate-950/70 backdrop-blur-sm"
          aria-label="Close fullscreen graph backdrop"
          onClick={() => setFullscreen(false)}
        />
      )}

      {effectiveInspectorCollapsed && selectedNode && (
        <button
          type="button"
          onClick={() => {
            if (fullscreen && autoHideInspector && !inspectorPinned) {
              setAutoHideInspector(false);
            }
            setInspectorCollapsed(false);
          }}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-bold text-white shadow-2xl shadow-slate-950/30 backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          Inspector
        </button>
      )}
    </motion.section>
  );
}
