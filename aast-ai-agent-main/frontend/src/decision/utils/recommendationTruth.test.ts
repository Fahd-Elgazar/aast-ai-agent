import { extractVerifiedRecommendations, validateRecommendationResponse } from './recommendationTruth.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const verified = {
  program_id: 'AI-1',
  program_name: 'Artificial Intelligence',
  college_name: 'College of Computing',
  score: 88.25,
  match_type: 'Exact',
  confidence_level: 'High',
  estimated_semester_fee: null,
  currency: null,
  fee_mode: null,
  affordability_label: 'unknown',
  score_breakdown: {
    interest_alignment: 95,
    interest_alignment_contribution: 60,
    affordability: 55,
    affordability_contribution: 20,
    employment_outlook: 80,
    employment_outlook_contribution: 5,
    location_preference: 100,
    location_preference_contribution: 3,
    career_flexibility: 75,
    career_flexibility_contribution: 2.25,
    certificate_compatibility: 100,
    certificate_compatibility_contribution: 2,
    decision_data_completeness: 80,
    weighted_subtotal: 92.25,
    missing_data_penalty: 4,
    total: 88.25,
  },
  warnings: ['Tuition is unavailable.'],
};

const cards = extractVerifiedRecommendations({ recommendations: [verified] });
assert(cards.length === 1, 'a complete upstream recommendation must be rendered');
assert(cards[0]?.program_name === verified.program_name, 'program name must be preserved');
assert(cards[0]?.score === verified.score, 'score must be preserved');
assert(cards[0]?.estimated_semester_fee === null, 'missing tuition must remain null');
assert(cards[0]?.currency === '', 'missing fee metadata must remain undisplayed');

assert(
  extractVerifiedRecommendations({ decision: { recommended_major: 'Computer Science' } }).length === 0,
  'an incomplete decision must not become a fabricated card',
);
assert(
  extractVerifiedRecommendations({ recommendations: [{ ...verified, score_breakdown: {} }] }).length === 0,
  'a missing score breakdown must not be reconstructed',
);
assert(
  extractVerifiedRecommendations({ recommendations: [{ ...verified, score_breakdown: { ...verified.score_breakdown, total: 87 } }] }).length === 0,
  'a score that disagrees with the displayed total must not be rendered',
);
assert(
  extractVerifiedRecommendations({ recommendations: [{ ...verified, score_breakdown: { ...verified.score_breakdown, weighted_subtotal: 90 } }] }).length === 0,
  'a breakdown whose contributions do not match its subtotal must not be rendered',
);
assert(
  extractVerifiedRecommendations({ recommendations: [{ ...verified, estimated_semester_fee: 5000 }] }).length === 0,
  'a fee without its upstream currency and mode must not be displayed',
);
assert(extractVerifiedRecommendations({ recommendations: [] }).length === 0, 'empty results must stay empty');
assert(
  extractVerifiedRecommendations({ success: false, recommendations: [verified] }).length === 0,
  'a failed envelope must not render a recommendation card',
);
assert(
  extractVerifiedRecommendations({ success: true, result_status: 'no_results', recommendations: [verified] }).length === 0,
  'a no-results envelope must not render a contradictory recommendation card',
);
assert(
  extractVerifiedRecommendations({ recommendations: [verified] }).length === 1,
  'an orchestrator envelope without direct-API status fields must remain compatible',
);

assert(
  validateRecommendationResponse({
    success: true,
    result_status: 'ok',
    recommended_major: verified.program_name,
    recommendations: [verified],
  }),
  'a complete ok result must be accepted',
);
assert(
  validateRecommendationResponse({
    success: true,
    result_status: 'no_results',
    recommended_major: null,
    confidence: null,
    score_breakdown: null,
    recommendations: [],
  }),
  'an explicit empty result must be accepted',
);
assert(
  !validateRecommendationResponse({
    success: true,
    result_status: 'ok',
    recommended_major: null,
    recommendations: [],
  }),
  'an ok result without a verified recommendation must be rejected',
);
assert(
  !validateRecommendationResponse({
    success: true,
    result_status: 'no_results',
    recommended_major: null,
    confidence: 91,
    score_breakdown: verified.score_breakdown,
    recommendations: [],
  }),
  'a no-results envelope with confidence or scoring data must be rejected',
);
assert(
  !validateRecommendationResponse({
    success: true,
    result_status: 'no_results',
    recommendations: [],
  }),
  'a no-results envelope must explicitly null every unavailable result field',
);

console.log('Frontend Decision truth tests passed.');
