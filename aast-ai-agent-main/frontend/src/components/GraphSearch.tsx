import { AnimatePresence, motion } from "framer-motion";
import { Search, Target, X } from "lucide-react";
import type { KnowledgeGraphNode } from "./graphUtils";
import { getNodeStyle } from "./graphUtils";

interface GraphSearchProps {
  query: string;
  matches: KnowledgeGraphNode[];
  onQueryChange: (query: string) => void;
  onSelectNode: (nodeId: string) => void;
  onClear: () => void;
}

export default function GraphSearch({
  query,
  matches,
  onQueryChange,
  onSelectNode,
  onClear,
}: GraphSearchProps) {
  const trimmedQuery = query.trim();

  return (
    <div className="relative min-w-0">
      <label htmlFor="graph-search" className="sr-only">
        Search graph entities
      </label>
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/92 px-3 py-2 shadow-lg shadow-slate-900/10 backdrop-blur transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/20">
        <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          id="graph-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search professor, course, major..."
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          autoComplete="off"
        />
        {trimmedQuery && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Clear graph search"
            title="Clear graph search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {trimmedQuery && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="custom-scrollbar absolute left-0 right-0 top-12 z-30 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/20"
          >
            {matches.length === 0 && (
              <div className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
                No matching graph entities.
              </div>
            )}

            {matches.slice(0, 8).map((node) => {
              const style = getNodeStyle(node.type);

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: style.color, boxShadow: `0 0 0 5px ${style.softColor}` }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {node.label}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {node.type} - {node.degree} connection{node.degree === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Target className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
