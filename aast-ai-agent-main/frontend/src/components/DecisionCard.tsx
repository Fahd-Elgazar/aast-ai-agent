import type { DecisionData } from "../types";

interface DecisionCardProps {
  data: DecisionData;
}

const DecisionCard: React.FC<DecisionCardProps> = ({ data }) => {
  const confidence = Math.max(0, Math.min(data.confidence, 100));

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Recommended Major
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {data.recommended_major}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Confidence
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">{confidence}%</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-white/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Reason
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{data.reason}</p>
      </div>

      <div className="mt-4 rounded-lg bg-white/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Warnings
        </p>
        {data.warnings.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {data.warnings.map((warning) => (
              <li key={warning} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                {warning}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No warnings.</p>
        )}
      </div>
    </div>
  );
};

export default DecisionCard;
