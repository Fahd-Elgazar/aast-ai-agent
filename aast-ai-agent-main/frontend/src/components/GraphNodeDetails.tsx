import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  GitBranch,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Pin,
  PinOff,
  Target,
  X,
} from "lucide-react";
import type { KnowledgeGraphLink, KnowledgeGraphNode } from "./graphUtils";
import {
  formatPropertyValue,
  getEndpointId,
  getNodeStyle,
  getRelationshipStyle,
} from "./graphUtils";

interface GraphNodeDetailsProps {
  node: KnowledgeGraphNode | null;
  connectedLinks: KnowledgeGraphLink[];
  nodeMap: Map<string, KnowledgeGraphNode>;
  isCollapsed: boolean;
  pinned: boolean;
  autoHidden: boolean;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onTogglePin: () => void;
}

function readRole(node: KnowledgeGraphNode): string {
  const role = node.properties.role ?? node.properties.title ?? node.properties.position;
  if (typeof role === "string" && role.trim()) return role;
  return node.rawType || node.type;
}

function metadataEntries(node: KnowledgeGraphNode): [string, unknown][] {
  return Object.entries(node.properties)
    .filter(([key]) => !["name", "label", "title", "role", "type"].includes(key.toLowerCase()))
    .slice(0, 10);
}

export default function GraphNodeDetails({
  node,
  connectedLinks,
  nodeMap,
  isCollapsed,
  pinned,
  autoHidden,
  onClose,
  onFocusNode,
  onToggleCollapse,
  onTogglePin,
}: GraphNodeDetailsProps) {
  if (!node) {
    return (
      <aside className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white/94 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inspector</p>
            <h3 className="text-sm font-bold text-slate-900">Node Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Collapse inspector"
            title="Collapse inspector"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          Select a node to inspect its academic role, evidence links, metadata, and connected entities.
        </div>
      </aside>
    );
  }

  const style = getNodeStyle(node.type);
  const entries = metadataEntries(node);
  const sortedConnectedLinks = [...connectedLinks].sort((left, right) => {
    const leftLabel = getRelationshipStyle(left.type).label;
    const rightLabel = getRelationshipStyle(right.type).label;
    return leftLabel.localeCompare(rightLabel);
  });

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur">
      <header className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inspector</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-slate-950">
              {node.label}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onTogglePin}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              aria-label={pinned ? "Unpin inspector" : "Pin inspector"}
              title={pinned ? "Unpin inspector" : "Pin inspector"}
            >
              {pinned ? <Pin className="h-4 w-4" aria-hidden="true" /> : <PinOff className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              aria-label="Collapse inspector"
              title="Collapse inspector"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full border px-3 py-1 text-xs font-bold"
            style={{ color: style.textColor, backgroundColor: style.softColor, borderColor: style.borderColor }}
          >
            {node.type}
          </span>
          {node.isPrimary && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              Primary evidence
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {node.degree} connection{node.degree === 1 ? "" : "s"}
          </span>
          {autoHidden && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              Auto-hidden
            </span>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Role</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{readRole(node)}</p>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              Connected Entities
            </h4>
            <button
              type="button"
              onClick={() => onToggleCollapse(node.id)}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          <div className="space-y-2">
            {connectedLinks.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No connected entities returned with this graph payload.
              </p>
            )}

            {sortedConnectedLinks.map((link) => {
              const sourceId = getEndpointId(link.source);
              const targetId = getEndpointId(link.target);
              const otherId = sourceId === node.id ? targetId : sourceId;
              const otherNode = nodeMap.get(otherId);
              const relationStyle = getRelationshipStyle(link.type);
              const direction = sourceId === node.id ? "outbound" : "inbound";
              const DirectionIcon = direction === "outbound" ? ArrowUpRight : ArrowDownLeft;

              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onFocusNode(otherId)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                      <DirectionIcon className="h-3.5 w-3.5" style={{ color: relationStyle.color }} />
                    </span>
                    <span className="truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {relationStyle.label}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                    {otherNode?.label || otherId}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {otherNode?.type || "Entity"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Metadata
          </h4>

          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No extra metadata fields were included by the backend.
              </p>
            )}

            {entries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{key}</p>
                <p className="mt-1 break-words text-sm text-slate-700">
                  {formatPropertyValue(value)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => onFocusNode(node.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <Target className="h-4 w-4" aria-hidden="true" />
          Center This Node
        </button>
      </footer>
    </aside>
  );
}
