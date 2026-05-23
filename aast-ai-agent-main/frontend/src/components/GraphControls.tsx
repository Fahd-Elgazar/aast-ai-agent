import {
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  SquareSplitHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ReactNode } from "react";

export type GraphPanelMode = "compact" | "balanced" | "expanded" | "custom";
export type LegendPanelMode = "expanded" | "compact" | "collapsed";

interface GraphControlsProps {
  showLabels: boolean;
  physicsEnabled: boolean;
  fullscreen: boolean;
  panelMode: GraphPanelMode;
  legendMode: LegendPanelMode;
  inspectorCollapsed: boolean;
  inspectorPinned: boolean;
  autoHideInspector: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onToggleLabels: () => void;
  onTogglePhysics: () => void;
  onToggleFullscreen: () => void;
  onPanelModeChange: (mode: GraphPanelMode) => void;
  onToggleLegend: () => void;
  onToggleInspector: () => void;
  onToggleInspectorPin: () => void;
  onToggleAutoHideInspector: () => void;
}

function IconButton({
  label,
  active,
  emphasis,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  emphasis?: "gold" | "blue";
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
        active
          ? emphasis === "gold"
            ? "border-gold-300 bg-gold-50 text-gold-800"
            : "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />;
}

function ControlCluster({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100/70 p-0.5 ring-1 ring-slate-200/80">
      {children}
    </div>
  );
}

export default function GraphControls({
  showLabels,
  physicsEnabled,
  fullscreen,
  panelMode,
  legendMode,
  inspectorCollapsed,
  inspectorPinned,
  autoHideInspector,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onToggleLabels,
  onTogglePhysics,
  onToggleFullscreen,
  onPanelModeChange,
  onToggleLegend,
  onToggleInspector,
  onToggleInspectorPin,
  onToggleAutoHideInspector,
}: GraphControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Graph explorer controls"
      className="custom-scrollbar flex w-full max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white/92 p-1 shadow-lg shadow-slate-900/10 backdrop-blur xl:w-auto"
    >
      <ControlCluster>
        <IconButton label="Compact graph panel" active={panelMode === "compact"} onClick={() => onPanelModeChange("compact")}>
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Balanced graph panel" active={panelMode === "balanced" || panelMode === "custom"} onClick={() => onPanelModeChange("balanced")}>
          <SquareSplitHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Expand graph panel" active={panelMode === "expanded"} onClick={() => onPanelModeChange("expanded")}>
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </ControlCluster>
      <ToolbarDivider />
      <ControlCluster>
        <IconButton label="Zoom in" onClick={onZoomIn}>
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Zoom out" onClick={onZoomOut}>
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Fit graph" onClick={onFit}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={showLabels ? "Hide labels" : "Show labels"} active={showLabels} onClick={onToggleLabels}>
          {showLabels ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      </ControlCluster>
      <ToolbarDivider />
      <ControlCluster>
        <IconButton
          label={physicsEnabled ? "Pause layout physics" : "Resume layout physics"}
          active={physicsEnabled}
          onClick={onTogglePhysics}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Reset graph layout" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </ControlCluster>
      <ToolbarDivider />
      <ControlCluster>
        <IconButton
          label={legendMode === "collapsed" ? "Show legend panel" : "Hide legend panel"}
          active={legendMode !== "collapsed"}
          onClick={onToggleLegend}
        >
          <Columns3 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={inspectorCollapsed ? "Show inspector panel" : "Hide inspector panel"}
          active={!inspectorCollapsed}
          onClick={onToggleInspector}
        >
          {inspectorCollapsed ? <PanelRightOpen className="h-4 w-4" aria-hidden="true" /> : <PanelRightClose className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
        <IconButton
          label={inspectorPinned ? "Unpin inspector panel" : "Pin inspector panel"}
          active={inspectorPinned}
          onClick={onToggleInspectorPin}
        >
          {inspectorPinned ? <Pin className="h-4 w-4" aria-hidden="true" /> : <PinOff className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
        <IconButton
          label={autoHideInspector ? "Keep inspector visible in fullscreen" : "Auto-hide inspector in fullscreen"}
          active={autoHideInspector}
          emphasis="gold"
          onClick={onToggleAutoHideInspector}
        >
          {autoHideInspector ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      </ControlCluster>
      <ToolbarDivider />
      <ControlCluster>
        <IconButton
          label={fullscreen ? "Exit fullscreen graph" : "Open fullscreen graph"}
          active={fullscreen}
          emphasis="gold"
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
      </ControlCluster>
    </div>
  );
}
