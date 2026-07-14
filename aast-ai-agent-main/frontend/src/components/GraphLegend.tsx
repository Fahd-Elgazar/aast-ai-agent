import {
  Award,
  BookOpen,
  Briefcase,
  Building2,
  GraduationCap,
  Layers,
  Maximize2,
  Network,
  PanelLeftClose,
  RotateCcw,
  Rows3,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LegendPanelMode } from "./GraphControls";
import type { GraphEntityKind } from "./graphUtils";
import {
  NODE_TYPE_ORDER,
  getNodeStyle,
  getRelationshipStyle,
  importantRelationshipTypes,
} from "./graphUtils";

interface GraphLegendProps {
  mode: LegendPanelMode;
  typeCounts: Record<GraphEntityKind, number>;
  relationshipCounts: Record<string, number>;
  enabledTypes: Set<GraphEntityKind>;
  activeRelationship: string | null;
  onModeChange: (mode: LegendPanelMode) => void;
  onToggleType: (type: GraphEntityKind) => void;
  onResetTypes: () => void;
  onRelationshipFocus: (type: string | null) => void;
}

const TYPE_ICONS: Record<GraphEntityKind, LucideIcon> = {
  Program: GraduationCap,
  Major: Network,
  Course: BookOpen,
  Leadership: Award,
  Metadata: ShieldCheck,
  Professor: Users,
  Department: Building2,
  "Quality Unit": ShieldCheck,
  Role: Award,
  Career: Briefcase,
  Scholarship: Award,
  Policy: Layers,
  Entity: Network,
};

export default function GraphLegend({
  mode,
  typeCounts,
  relationshipCounts,
  enabledTypes,
  activeRelationship,
  onModeChange,
  onToggleType,
  onResetTypes,
  onRelationshipFocus,
}: GraphLegendProps) {
  const visibleTypes = NODE_TYPE_ORDER.filter((type) => typeCounts[type] > 0);
  const relationships = importantRelationshipTypes(relationshipCounts);
  const compact = mode === "compact";
  const visibleCount = visibleTypes.filter((type) => enabledTypes.has(type)).length;

  return (
    <aside className="flex max-h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white/94 p-3 shadow-xl shadow-slate-900/10 backdrop-blur transition-all">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Legend</p>
          <h3 className="truncate text-sm font-bold text-slate-900">
            {compact ? "Compact Filters" : "Entity Intelligence"}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange(compact ? "expanded" : "compact")}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label={compact ? "Expand legend" : "Compact legend"}
            title={compact ? "Expand legend" : "Compact legend"}
          >
            {compact ? <Maximize2 className="h-4 w-4" aria-hidden="true" /> : <Rows3 className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("collapsed")}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Collapse legend"
            title="Collapse legend"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {compact && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {visibleTypes.map((type) => {
            const style = getNodeStyle(type);
            const enabled = enabledTypes.has(type);

            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggleType(type)}
                aria-pressed={enabled}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  enabled ? "opacity-100" : "opacity-45"
                }`}
                style={{
                  color: style.textColor,
                  borderColor: style.borderColor,
                  backgroundColor: style.softColor,
                }}
              >
                {typeCounts[type]} {type}
              </button>
            );
          })}
        </div>
      )}

      <div className={`custom-scrollbar min-h-0 space-y-4 overflow-y-auto pr-1 ${compact ? "max-h-48" : ""}`}>
        <section aria-label="Node type filters">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Nodes</p>
            <button
              type="button"
              onClick={onResetTypes}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              title="Restore all node classes"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {visibleCount}/{visibleTypes.length}
            </button>
          </div>
          <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-1"}`}>
            {visibleTypes.map((type) => {
              const style = getNodeStyle(type);
              const enabled = enabledTypes.has(type);
              const Icon = TYPE_ICONS[type];

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  aria-pressed={enabled}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    enabled
                      ? "border-slate-200 bg-white text-slate-800 shadow-sm"
                      : "border-transparent bg-slate-50 text-slate-400 opacity-60"
                  } ${compact ? "py-1.5" : "py-2"}`}
                >
                  <span
                    className={`${compact ? "h-6 w-6" : "h-7 w-7"} flex items-center justify-center rounded-lg`}
                    style={{ backgroundColor: style.softColor, color: style.color }}
                    aria-hidden="true"
                  >
                    <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{type}</span>
                    {!compact && (
                      <span className="block text-[11px] text-slate-500">
                        {typeCounts[type]} node{typeCounts[type] === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {!compact && <section aria-label="Relationship focus">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Relationships</p>
            {activeRelationship && (
              <button
                type="button"
                onClick={() => onRelationshipFocus(null)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {relationships.length === 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No relationship evidence yet.
              </p>
            )}

            {relationships.map((type) => {
              const style = getRelationshipStyle(type);
              const active = activeRelationship === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onRelationshipFocus(active ? null : type)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    active
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className="h-0.5 w-7 rounded-full"
                    style={{ backgroundColor: style.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{style.label}</span>
                    <span className="block text-[11px] text-slate-500">
                      {relationshipCounts[type]} edge{relationshipCounts[type] === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>}
      </div>
    </aside>
  );
}
