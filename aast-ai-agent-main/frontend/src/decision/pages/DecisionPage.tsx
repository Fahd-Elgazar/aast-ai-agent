import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudent } from '../../decision/context/StudentContext';
import DecisionForm from '../../decision/components/DecisionForm';
import CollegeCard from '../../decision/components/CollegeCard';
import { Loader2 } from 'lucide-react';
import { getRecommendation, type RecommendationResponse } from '../../services/decisionApi';
import { readAuthSession } from '../../services/authStorage';
import type { RecommendationCardData } from '../../types';
import { extractVerifiedRecommendations } from '../utils/recommendationTruth';

function normalizeRecommendations(data: RecommendationResponse): RecommendationCardData[] {
  return extractVerifiedRecommendations(data);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const canAccessAdmin = readAuthSession()?.user.role === 'admin';
  const { profile } = useStudent();
  const [recommendations, setRecommendations] = useState<RecommendationCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);

      try {
        if (profile.high_school_percentage == null || profile.budget == null) {
          setRecommendations([]);
          setError("Enter your high school percentage and budget to get recommendations.");
          return;
        }

        const payload = {
          studentProfile: {
            high_school_percentage: Number(profile.high_school_percentage),
            budget: Number(profile.budget),
            preferred_branch: profile.preferred_branch || null,
          },
          preferences: {
            interests: profile.interests,
          },
        };

        const data = await getRecommendation(payload);
        setRecommendations(normalizeRecommendations(data));
      } catch (err) {
        console.error("Recommendation API error:", err);
        setError("Unable to fetch verified recommendations from the decision service.");
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(() => {
      fetchRecommendations();
    }, 500);

    return () => clearTimeout(debounce);
  }, [profile]);

  return (
    <div className="flex h-full w-full">
      <aside className="w-[340px] h-full border-r border-slate-200 bg-white shadow-sm flex flex-col z-0 shrink-0">
        <div className="p-6 flex-1 overflow-y-auto w-full">
          <h2 className="text-lg font-bold text-aast-navy mb-6">Decision Inputs</h2>
          <DecisionForm />
          <div className="mt-8 pt-6 border-t flex flex-col gap-2 border-slate-200">
            <button
              onClick={() => navigate("/decision/chat")}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-3 cursor-pointer"
            >
              Open Decision Chat
            </button>
            <button
              onClick={() => navigate("/decision/admin")}
              hidden={!canAccessAdmin}
              className="bg-red-500 text-white px-4 py-2 rounded mt-3 cursor-pointer"
            >
              Admin Panel
            </button>
          </div>
        </div>
      </aside>

      <section className="flex-1 h-full bg-slate-50 flex flex-col overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Program Recommendations</h2>
            {loading && (
              <div className="flex items-center gap-2 text-aast-navy text-sm font-medium">
                <Loader2 className="animate-spin" size={16} />
                Updating Results...
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
              {error}
            </div>
          )}

          {!loading && !error && recommendations.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center text-slate-500 flex flex-col items-center">
              <span className="text-4xl mb-4">Search</span>
              <p className="text-lg">No recommendations found matching your current strict criteria.</p>
              <p className="text-sm mt-2 max-w-md">Try relaxing your budget, adding more interests, or choosing a different campus.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
            {recommendations.map((rec, idx) => (
              <CollegeCard
                key={`${rec.program_id}-${idx}`}
                programName={rec.program_name}
                collegeName={rec.college_name}
                matchScore={rec.score}
                matchType={rec.match_type}
                confidence={rec.confidence_level}
                fee={rec.estimated_semester_fee}
                currency={rec.currency}
                feeMode={rec.fee_mode}
                affordability={rec.affordability_label}
                scoreBreakdown={rec.score_breakdown}
                warnings={rec.warnings || []}
                careerRoadmap={rec.career_roadmap || null}
                nextSteps={rec.next_steps || []}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
