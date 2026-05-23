import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactElement } from "react";
import { forceCollide, forceX, forceY } from "d3-force";
import ForceGraph2D from "react-force-graph-2d";
import type { KnowledgeGraphLink, KnowledgeGraphNode, NormalizedGraph } from "./graphUtils";
import {
  CLUSTER_ANCHORS,
  getEndpointId,
  getNodeStyle,
  getRelationshipStyle,
} from "./graphUtils";

export interface GraphCanvasApi {
  zoom(): number;
  zoom(scale: number, durationMs?: number): unknown;
  centerAt(x?: number, y?: number, durationMs?: number): unknown;
  zoomToFit(durationMs?: number, padding?: number): unknown;
  d3Force(forceName: string): unknown;
  d3Force(forceName: string, forceFn: unknown): unknown;
  d3ReheatSimulation(): unknown;
  pauseAnimation(): unknown;
  resumeAnimation(): unknown;
}

interface TunableForce {
  strength?: (value: number) => unknown;
  distance?: (value: number) => unknown;
  iterations?: (value: number) => unknown;
}

interface GraphViewProps {
  graph: NormalizedGraph;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredLinkId: string | null;
  activeRelationship: string | null;
  highlightedNodeIds: Set<string>;
  highlightedLinkIds: Set<string>;
  showLabels: boolean;
  physicsEnabled: boolean;
  focusVersion: number;
  graphRef: MutableRefObject<GraphCanvasApi | undefined>;
  onNodeSelect: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onLinkHover: (linkId: string | null) => void;
}

const ForceGraphCanvas = ForceGraph2D as unknown as (
  props: Record<string, unknown> & { ref?: MutableRefObject<GraphCanvasApi | undefined> },
) => ReactElement;

function useElementSize<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { elementRef, size };
}

function getNodeRadius(node: KnowledgeGraphNode): number {
  if (node.isPrimary && node.type === "Program") return 28;
  if (node.type === "Major") return 17;
  if (node.type === "Leadership") return 14.5;
  if (node.type === "Metadata") return 12.5;
  const base = node.isPrimary ? 17 : 11.5;
  return Math.min(28, base + Math.sqrt(Math.max(node.degree, 1)) * 2.35);
}

function endpointNode(endpoint: string | KnowledgeGraphNode, nodeMap: Map<string, KnowledgeGraphNode>) {
  return typeof endpoint === "string" ? nodeMap.get(endpoint) : endpoint;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let next = text;
  while (next.length > 3 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }

  return `${next}...`;
}

function drawCanvasLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  globalScale: number,
  options: {
    color: string;
    background: string;
    maxWidth: number;
    bold?: boolean;
    borderColor?: string;
  },
) {
  const fontSize = Math.max(9, 12 / globalScale);
  const paddingX = 8 / globalScale;
  const paddingY = 4.5 / globalScale;
  ctx.font = `${options.bold ? 700 : 600} ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const label = truncateText(ctx, text, options.maxWidth / globalScale);
  const metrics = ctx.measureText(label);
  const width = metrics.width + paddingX * 2;
  const height = fontSize + paddingY * 2;

  roundRect(ctx, x - width / 2, y - height / 2, width, height, 7 / globalScale);
  ctx.shadowColor = "rgba(2, 6, 23, 0.22)";
  ctx.shadowBlur = 10 / globalScale;
  ctx.fillStyle = options.background;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (options.borderColor) {
    ctx.strokeStyle = options.borderColor;
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
  }
  ctx.fillStyle = options.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 0.5 / globalScale);
}

export default function GraphView({
  graph,
  selectedNodeId,
  hoveredNodeId,
  hoveredLinkId,
  activeRelationship,
  highlightedNodeIds,
  highlightedLinkIds,
  showLabels,
  physicsEnabled,
  focusVersion,
  graphRef,
  onNodeSelect,
  onNodeHover,
  onLinkHover,
}: GraphViewProps) {
  const { elementRef, size } = useElementSize<HTMLDivElement>();
  const width = Math.max(320, size.width || 720);
  const height = Math.max(380, size.height || 640);
  const hasFocus = highlightedNodeIds.size > 0 || highlightedLinkIds.size > 0 || !!activeRelationship;
  const demoMode = graph.isDemo;

  const graphData = useMemo(
    () => ({
      nodes: graph.nodes,
      links: graph.links,
    }),
    [graph.links, graph.nodes],
  );

  useEffect(() => {
    const api = graphRef.current;
    if (!api || graph.nodes.length === 0) return;

    const denseGraph = graph.nodes.length > 70 || graph.links.length > 110;
    const charge = api.d3Force("charge") as TunableForce | undefined;
    const linkForce = api.d3Force("link") as TunableForce | undefined;

    charge?.strength?.(demoMode ? -215 : denseGraph ? -132 : -285);
    linkForce?.distance?.(demoMode ? 132 : denseGraph ? 82 : 118);
    linkForce?.iterations?.(denseGraph ? 1 : 2);

    api.d3Force(
      "collide",
      forceCollide<KnowledgeGraphNode>((node) => getNodeRadius(node) + (demoMode ? 14 : denseGraph ? 6 : 11)).iterations(2),
    );
    api.d3Force(
      "clusterX",
      forceX<KnowledgeGraphNode>((node) => CLUSTER_ANCHORS[node.type]?.x ?? 0).strength(demoMode ? 0.038 : denseGraph ? 0.035 : 0.065),
    );
    api.d3Force(
      "clusterY",
      forceY<KnowledgeGraphNode>((node) => CLUSTER_ANCHORS[node.type]?.y ?? 0).strength(demoMode ? 0.038 : denseGraph ? 0.035 : 0.065),
    );
    api.d3ReheatSimulation();
  }, [demoMode, graph.links.length, graph.nodes.length, graphRef]);

  useEffect(() => {
    const api = graphRef.current;
    if (!api) return;

    if (physicsEnabled) {
      api.resumeAnimation();
      api.d3ReheatSimulation();
    } else {
      api.pauseAnimation();
    }
  }, [graphRef, physicsEnabled]);

  useEffect(() => {
    const api = graphRef.current;
    if (!api || graph.nodes.length === 0) return;
    const denseGraph = graph.nodes.length > 70 || graph.links.length > 110;

    const timeout = window.setTimeout(() => {
      api.zoomToFit(800, denseGraph ? 72 : 58);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [graph.links.length, graph.nodes.length, graphRef]);

  useEffect(() => {
    const api = graphRef.current;
    if (!api || graph.nodes.length === 0) return;

    const timeout = window.setTimeout(() => {
      if (selectedNodeId) {
        const node = graph.nodeMap.get(selectedNodeId);
        if (typeof node?.x === "number" && typeof node?.y === "number") {
          api.centerAt(node.x, node.y, 280);
          return;
        }
      }
      api.zoomToFit(320, 50);
    }, 140);

    return () => window.clearTimeout(timeout);
  }, [graph.nodeMap, graph.nodes.length, graphRef, height, selectedNodeId, width]);

  useEffect(() => {
    const api = graphRef.current;
    if (!api || !selectedNodeId) return;

    const node = graph.nodeMap.get(selectedNodeId);
    if (typeof node?.x !== "number" || typeof node?.y !== "number") return;

    api.centerAt(node.x, node.y, 650);
    api.zoom(Math.max(api.zoom(), 1.35), 650);
  }, [focusVersion, graph.nodeMap, graphRef, selectedNodeId]);

  const isLinkHighlighted = (link: KnowledgeGraphLink) =>
    highlightedLinkIds.has(link.id) ||
    hoveredLinkId === link.id ||
    activeRelationship === link.type ||
    (selectedNodeId
      ? getEndpointId(link.source) === selectedNodeId || getEndpointId(link.target) === selectedNodeId
      : false);

  const nodeCanvasObject = (node: KnowledgeGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") return;

    const style = getNodeStyle(node.type);
    const selected = selectedNodeId === node.id;
    const hovered = hoveredNodeId === node.id;
    const highlighted = highlightedNodeIds.has(node.id) || selected || hovered || !hasFocus;
    const radius = getNodeRadius(node);
    const primaryPulse = demoMode && node.isPrimary ? (Math.sin(Date.now() / 420) + 1) / 2 : 0;

    ctx.save();
    ctx.globalAlpha = highlighted ? 1 : 0.18;

    if (node.isPrimary || selected || hovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + (selected ? 13 : 8) + primaryPulse * 8, 0, Math.PI * 2);
      ctx.fillStyle = style.glowColor;
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = demoMode && node.isPrimary ? 34 : selected ? 24 : 15;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = selected ? style.color : "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = style.color;
    ctx.lineWidth = selected || node.isPrimary ? 3.2 / globalScale : 2 / globalScale;
    ctx.shadowColor = selected ? style.glowColor : "rgba(2, 6, 23, 0.32)";
    ctx.shadowBlur = demoMode && (node.isPrimary || selected) ? 24 : selected ? 18 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, Math.max(3.5, radius * 0.38), 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#ffffff" : style.color;
    ctx.fill();

    if (node.isPrimary) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + (demoMode ? 8 + primaryPulse * 5 : 5) / globalScale, 0, Math.PI * 2);
      ctx.strokeStyle = demoMode ? `rgba(216, 180, 254, ${0.36 + primaryPulse * 0.24})` : "rgba(37, 99, 235, 0.34)";
      ctx.lineWidth = (demoMode ? 2.8 : 2) / globalScale;
      ctx.stroke();
    }

    const shouldDrawLabel = showLabels && (globalScale > 0.38 || node.isPrimary || selected || hovered);
    if (shouldDrawLabel) {
      drawCanvasLabel(ctx, node.label, node.x, node.y + radius + 13 / globalScale, globalScale, {
        color: selected ? "#ffffff" : "#f8fafc",
        background: selected ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.82)",
        borderColor: selected || (demoMode && node.isPrimary) ? style.borderColor : "rgba(255, 255, 255, 0.12)",
        maxWidth: node.isPrimary ? 230 : 165,
        bold: node.isPrimary || selected,
      });
    }

    ctx.restore();
  };

  const nodePointerAreaPaint = (
    node: KnowledgeGraphNode,
    paintColor: string,
    ctx: CanvasRenderingContext2D,
  ) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    ctx.fillStyle = paintColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, getNodeRadius(node) + 8, 0, Math.PI * 2);
    ctx.fill();
  };

  const linkCanvasObject = (link: KnowledgeGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!showLabels) return;

    const source = endpointNode(link.source, graph.nodeMap);
    const target = endpointNode(link.target, graph.nodeMap);
    if (!source || !target) return;
    if (typeof source.x !== "number" || typeof source.y !== "number") return;
    if (typeof target.x !== "number" || typeof target.y !== "number") return;

    const highlighted = isLinkHighlighted(link);
    if (globalScale < 0.56 && !highlighted) return;

    const style = getRelationshipStyle(link.type);
    const midX = source.x + (target.x - source.x) * 0.5;
    const midY = source.y + (target.y - source.y) * 0.5;
    const curveOffset = link.curvature * 52;
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const labelX = midX + Math.cos(angle + Math.PI / 2) * curveOffset;
    const labelY = midY + Math.sin(angle + Math.PI / 2) * curveOffset;

    ctx.save();
    ctx.globalAlpha = highlighted || !hasFocus ? 1 : 0.24;
    drawCanvasLabel(ctx, style.label, labelX, labelY, globalScale, {
      color: style.color,
      background: "rgba(15, 23, 42, 0.86)",
      borderColor: style.softColor,
      maxWidth: 150,
      bold: highlighted,
    });
    ctx.restore();
  };

  return (
    <div
      ref={elementRef}
      className={`relative h-full min-h-[380px] w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-slate-950 shadow-inner shadow-slate-950/60 ${
        demoMode ? "border-cyan-300/20" : "border-white/10"
      }`}
      role="img"
      aria-label={`Knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} relationships`}
      style={{
        backgroundImage:
          demoMode
            ? "linear-gradient(rgba(125, 211, 252, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 211, 252, 0.09) 1px, transparent 1px), linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.98))"
            : "radial-gradient(circle at 18% 12%, rgba(37, 99, 235, 0.16), transparent 28%), radial-gradient(circle at 82% 18%, rgba(212, 175, 55, 0.12), transparent 24%), linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        backgroundSize: demoMode ? "28px 28px, 28px 28px, auto" : "auto, auto, 30px 30px, 30px 30px",
      }}
    >
      <ForceGraphCanvas
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="rgba(2, 5, 20, 0)"
        nodeId="id"
        nodeLabel={(node: KnowledgeGraphNode) => {
          const role = typeof node.properties.role === "string" ? ` - ${node.properties.role}` : "";
          return `${node.label} (${node.type})${role} - ${node.degree} connection${node.degree === 1 ? "" : "s"}`;
        }}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkLabel={(link: KnowledgeGraphLink) => {
          const source = graph.nodeMap.get(getEndpointId(link.source))?.label || getEndpointId(link.source);
          const target = graph.nodeMap.get(getEndpointId(link.target))?.label || getEndpointId(link.target);
          return `${getRelationshipStyle(link.type).label}: ${source} -> ${target}`;
        }}
        linkColor={(link: KnowledgeGraphLink) => {
          const highlighted = isLinkHighlighted(link);
          return highlighted || !hasFocus ? getRelationshipStyle(link.type).color : "rgba(148, 163, 184, 0.24)";
        }}
        linkWidth={(link: KnowledgeGraphLink) => (isLinkHighlighted(link) ? (demoMode ? 3 : 2.4) : demoMode ? 1.35 : 1.15)}
        linkCurvature={(link: KnowledgeGraphLink) => link.curvature}
        linkLineDash={(link: KnowledgeGraphLink) => getRelationshipStyle(link.type).dash || null}
        linkDirectionalArrowLength={(link: KnowledgeGraphLink) => (isLinkHighlighted(link) ? 7 : 4)}
        linkDirectionalArrowColor={(link: KnowledgeGraphLink) => getRelationshipStyle(link.type).color}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalParticles={(link: KnowledgeGraphLink) => (isLinkHighlighted(link) ? (demoMode ? 4 : 2) : demoMode ? 1 : 0)}
        linkDirectionalParticleSpeed={demoMode ? 0.008 : 0.006}
        linkDirectionalParticleWidth={(link: KnowledgeGraphLink) => (isLinkHighlighted(link) ? 2.8 : 1)}
        linkDirectionalParticleColor={(link: KnowledgeGraphLink) => getRelationshipStyle(link.type).color}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "after"}
        linkHoverPrecision={7}
        minZoom={0.18}
        maxZoom={5}
        warmupTicks={graph.nodes.length > 80 ? 60 : 90}
        cooldownTicks={graph.nodes.length > 80 ? 120 : 180}
        d3AlphaDecay={graph.nodes.length > 80 ? 0.045 : 0.032}
        d3VelocityDecay={0.38}
        autoPauseRedraw={false}
        enableNodeDrag
        showPointerCursor
        onNodeClick={(node: KnowledgeGraphNode) => onNodeSelect(node.id)}
        onNodeHover={(node: KnowledgeGraphNode | null) => onNodeHover(node?.id || null)}
        onLinkHover={(link: KnowledgeGraphLink | null) => onLinkHover(link?.id || null)}
        onBackgroundClick={() => {
          onNodeHover(null);
          onLinkHover(null);
        }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-slate-950/78 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-lg shadow-slate-950/30 backdrop-blur">
        {graph.nodes.length} visible entities / {graph.links.length} links
      </div>
    </div>
  );
}
