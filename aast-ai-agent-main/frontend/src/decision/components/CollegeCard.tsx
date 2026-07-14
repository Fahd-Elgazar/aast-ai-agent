import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { ScoreBreakdown, CareerRoadmap } from '../../types';

export interface CollegeCardProps {
  programName: string;
  collegeName: string;
  matchScore: number;
  matchType: string;
  confidence: string;
  fee: number | null;
  currency: string;
  feeMode: string;
  affordability: string;
  scoreBreakdown: ScoreBreakdown;
  warnings?: string[];
  careerRoadmap?: CareerRoadmap | null;
  nextSteps?: string[];
}

export default function CollegeCard({
  programName,
  collegeName,
  matchScore,
  matchType,
  confidence,
  fee,
  currency,
  feeMode,
  affordability,
  scoreBreakdown,
  warnings = [],
  careerRoadmap = null,
  nextSteps = []
}: CollegeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (idx: number) => {
    const newChecked = new Set(checkedSteps);
    if (newChecked.has(idx)) {
      newChecked.delete(idx);
    } else {
      newChecked.add(idx);
    }
    setCheckedSteps(newChecked);
  };

  // Parse breakdown for the radar chart
  const radarData = [
    { subject: 'Interest', A: scoreBreakdown.interest_alignment || 0, fullMark: 100 },
    { subject: 'Affordability', A: scoreBreakdown.affordability || 0, fullMark: 100 },
    { subject: 'Employment', A: scoreBreakdown.employment_outlook || 0, fullMark: 100 },
    { subject: 'Location', A: scoreBreakdown.location_preference || 0, fullMark: 100 },
    { subject: 'Flexibility', A: scoreBreakdown.career_flexibility || 0, fullMark: 100 },
    { subject: 'Admission', A: scoreBreakdown.certificate_compatibility || 0, fullMark: 100 },
  ];

  // Circle color mapping
  const strokeColor = matchScore >= 80 ? '#16a34a' : matchScore >= 60 ? '#eab308' : '#ef4444';
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (matchScore / 100) * circumference;

  const normalizedAffordability = (affordability || '').trim().toLowerCase();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
      <div className="p-5 flex gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              matchType === 'Exact' ? 'bg-green-100 text-green-700' :
              matchType === 'Stretch' ? 'bg-yellow-100 text-yellow-700' :
              matchType === 'Partial' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {matchType} Match
            </span>
            {confidence === 'High' && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">High Confidence</span>}
          </div>
          <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{programName}</h3>
          <p className="text-sm text-slate-500 leading-snug">{collegeName}</p>
        </div>

        {/* Circular Score Indicator */}
        <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
          <svg className="transform -rotate-90 w-16 h-16">
            <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
            <circle cx="32" cy="32" r={radius} stroke={strokeColor} strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
          </svg>
          <span className="absolute text-sm font-bold text-slate-700">{Math.round(matchScore)}</span>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-500">Estimated Tuition</span>
            <span className={`font-semibold ${
              normalizedAffordability === 'match' ? 'text-green-600' :
              normalizedAffordability === 'stretch' ? 'text-orange-500' : 'text-red-500'
            }`}>
              {affordability.toUpperCase()}
            </span>
          </div>
          <div className="font-medium text-slate-800">
            {fee ? `${fee.toLocaleString()} ${currency} / ${feeMode}` : 'Tuition Unavailable'}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              {warnings[0]}
              {warnings.length > 1 && ` (+${warnings.length - 1} more)`}
            </div>
          </div>
        </div>
      )}

      {careerRoadmap && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-4 mt-2 bg-slate-50/50">
          <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-3">Career Roadmap</h4>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center mt-1.5 shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]"></div>
              <div className="w-0.5 h-7 bg-slate-200 my-1"></div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"></div>
              <div className="w-0.5 h-7 bg-slate-200 my-1"></div>
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_0_2px_rgba(168,85,247,0.2)]"></div>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-700 font-medium">
              <div className="min-h-[1.5rem] flex items-center">
                <span className="text-slate-800">{programName}</span>
              </div>
              <div className="min-h-[1.5rem] flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 text-xs">Skills:</span>
                {careerRoadmap?.top_skills?.map((skill, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedSkill(selectedSkill === skill ? null : skill);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors border ${selectedSkill === skill ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {skill}
                  </button>
                )) || <span className="text-slate-500 text-xs">Core Competencies</span>}
              </div>
              <div className="min-h-[1.5rem] flex items-center">
                <span className="text-purple-700 font-bold">{careerRoadmap?.target_roles?.[0] || 'Industry Professional'}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-100 shadow-sm leading-relaxed">
            "{careerRoadmap?.industry_demand || 'Stable market demand across regional sectors.'}"
          </div>

          {selectedSkill && careerRoadmap?.learning_path && (
            <div className="mt-3 bg-white/60 backdrop-blur-md p-3 rounded-lg border border-blue-100 shadow-[0_2px_8px_rgba(59,130,246,0.08)] transform transition-all duration-300">
              <h5 className="text-[11px] font-bold text-blue-800 mb-2 border-b border-blue-100 pb-1.5 flex justify-between items-center">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {selectedSkill} Resources
                </div>
                <button onClick={() => setSelectedSkill(null)} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
              </h5>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 marker:text-blue-400">
                {careerRoadmap.learning_path.find(p => p.skill === selectedSkill)?.steps?.map((step, idx) => (
                  <li key={idx} className="pl-1">{step}</li>
                )) || <li>Specialized online courses and hands-on labs.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-4 bg-blue-50/30">
          <h4 className="text-[10px] font-bold text-blue-600 tracking-wider uppercase mb-2">Your Next Steps</h4>
          <div className="flex flex-col gap-2">
            {nextSteps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-all ${checkedSteps.has(idx)
                  ? 'bg-blue-50/50 border-blue-200 opacity-60'
                  : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
                }`}
                onClick={() => toggleStep(idx)}
              >
                <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${checkedSteps.has(idx) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                }`}>
                  {checkedSteps.has(idx) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-xs font-medium ${checkedSteps.has(idx) ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Breakdown */}
      <div className="mt-auto border-t border-slate-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 px-5 flex items-center justify-between text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <span>Score Breakdown</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expanded && (
          <div className="px-5 pb-5 pt-2 bg-slate-50 border-t border-slate-100 shadow-inner">
            <div className="h-40 w-full font-sans text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 5, right: 15, bottom: 5, left: 15 }}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="Score" dataKey="A" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Completeness</span><span className="font-medium">{scoreBreakdown.decision_data_completeness}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Penalty</span><span className="font-medium text-red-500">-{scoreBreakdown.missing_data_penalty}%</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
