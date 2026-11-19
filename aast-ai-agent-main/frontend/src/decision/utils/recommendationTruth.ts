import type { CareerRoadmap, RecommendationCardData, ScoreBreakdown } from '../../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function readScoreBreakdown(value: unknown, expectedScore: number): ScoreBreakdown | null {
  if (!isRecord(value)) return null;

  const interestAlignment = readNumber(value.interest_alignment);
  const interestContribution = readNumber(value.interest_alignment_contribution);
  const affordability = readNumber(value.affordability);
  const affordabilityContribution = readNumber(value.affordability_contribution);
  const employmentOutlook = readNumber(value.employment_outlook);
  const employmentContribution = readNumber(value.employment_outlook_contribution);
  const locationPreference = readNumber(value.location_preference);
  const locationContribution = readNumber(value.location_preference_contribution);
  const careerFlexibility = readNumber(value.career_flexibility);
  const careerContribution = readNumber(value.career_flexibility_contribution);
  const certificateCompatibility = readNumber(value.certificate_compatibility);
  const certificateContribution = readNumber(value.certificate_compatibility_contribution);
  const completeness = readNumber(value.decision_data_completeness);
  const weightedSubtotal = readNumber(value.weighted_subtotal);
  const penalty = readNumber(value.missing_data_penalty);
  const total = readNumber(value.total);

  const bounded = (number: number | null): number is number =>
    number !== null && number >= 0 && number <= 100;

  if (
    !bounded(interestAlignment) ||
    !bounded(interestContribution) ||
    !bounded(affordability) ||
    !bounded(affordabilityContribution) ||
    !bounded(employmentOutlook) ||
    !bounded(employmentContribution) ||
    !bounded(locationPreference) ||
    !bounded(locationContribution) ||
    !bounded(careerFlexibility) ||
    !bounded(careerContribution) ||
    !bounded(certificateCompatibility) ||
    !bounded(certificateContribution) ||
    !bounded(completeness) ||
    !bounded(weightedSubtotal) ||
    !bounded(penalty) ||
    !bounded(total)
  ) {
    return null;
  }

  const contributionTotal = interestContribution + affordabilityContribution +
    employmentContribution + locationContribution + careerContribution + certificateContribution;
  const tolerance = 0.06;
  if (
    Math.abs(contributionTotal - weightedSubtotal) > tolerance ||
    Math.abs(Math.max(0, weightedSubtotal - penalty) - total) > tolerance ||
    Math.abs(total - expectedScore) > tolerance
  ) return null;

  return {
    interest_alignment: interestAlignment,
    interest_alignment_contribution: interestContribution,
    affordability,
    affordability_contribution: affordabilityContribution,
    employment_outlook: employmentOutlook,
    employment_outlook_contribution: employmentContribution,
    location_preference: locationPreference,
    location_preference_contribution: locationContribution,
    career_flexibility: careerFlexibility,
    career_flexibility_contribution: careerContribution,
    certificate_compatibility: certificateCompatibility,
    certificate_compatibility_contribution: certificateContribution,
    decision_data_completeness: completeness,
    weighted_subtotal: weightedSubtotal,
    missing_data_penalty: penalty,
    total,
  };
}

function readCareerRoadmap(value: unknown): CareerRoadmap | null {
  if (!isRecord(value)) return null;
  const targetRoles = readStrings(value.target_roles);
  const topSkills = readStrings(value.top_skills);
  const industryDemand = readString(value.industry_demand);
  if (targetRoles.length === 0 || topSkills.length === 0 || !industryDemand) return null;

  return {
    target_roles: targetRoles,
    top_skills: topSkills,
    industry_demand: industryDemand,
  };
}

function readRecommendation(value: unknown): RecommendationCardData | null {
  if (!isRecord(value)) return null;

  const programName = readString(value.program_name);
  const collegeName = readString(value.college_name);
  const score = readNumber(value.score);
  const matchType = readString(value.match_type);
  const confidenceLevel = readString(value.confidence_level);
  const affordabilityLabel = readString(value.affordability_label);
  const scoreBreakdown = score === null ? null : readScoreBreakdown(value.score_breakdown, score);
  const fee = value.estimated_semester_fee === null
    ? null
    : readNumber(value.estimated_semester_fee);

  if (
    !programName ||
    !collegeName ||
    score === null ||
    score < 0 ||
    score > 100 ||
    !matchType ||
    !confidenceLevel ||
    !affordabilityLabel ||
    !scoreBreakdown ||
    fee === null && value.estimated_semester_fee !== null
  ) {
    return null;
  }

  const currency = readString(value.currency);
  const feeMode = readString(value.fee_mode);
  if (fee !== null && (!currency || !feeMode)) return null;

  const recommendation: RecommendationCardData = {
    program_name: programName,
    college_name: collegeName,
    score,
    match_type: matchType,
    confidence_level: confidenceLevel,
    estimated_semester_fee: fee,
    currency: currency || '',
    fee_mode: feeMode || '',
    affordability_label: affordabilityLabel,
    score_breakdown: scoreBreakdown,
    warnings: readStrings(value.warnings),
  };

  const programId = readString(value.program_id);
  if (programId) recommendation.program_id = programId;

  const careerRoadmap = readCareerRoadmap(value.career_roadmap);
  if (careerRoadmap) recommendation.career_roadmap = careerRoadmap;

  const nextSteps = readStrings(value.next_steps);
  if (nextSteps.length > 0) recommendation.next_steps = nextSteps;

  return recommendation;
}

export function extractVerifiedRecommendations(response: unknown): RecommendationCardData[] {
  if (!isRecord(response)) return [];
  if ('success' in response && response.success !== true) return [];
  if ('result_status' in response && response.result_status !== 'ok') return [];

  const candidates = Array.isArray(response.recommendations)
    ? response.recommendations
    : isRecord(response.decision)
      ? [response.decision]
      : [];

  return candidates
    .map(readRecommendation)
    .filter((item): item is RecommendationCardData => item !== null);
}

function owns(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function validateRecommendationResponse(body: unknown): boolean {
  if (!isRecord(body) || body.success !== true) return false;

  if (body.result_status === 'no_results') {
    return owns(body, 'recommended_major') && body.recommended_major === null
      && owns(body, 'confidence') && body.confidence === null
      && owns(body, 'score_breakdown') && body.score_breakdown === null
      && Array.isArray(body.recommendations) && body.recommendations.length === 0;
  }

  if (body.result_status !== 'ok') return false;

  const recommendedMajor = typeof body.recommended_major === 'string'
    ? body.recommended_major.trim()
    : '';
  if (!recommendedMajor || !Array.isArray(body.recommendations) || body.recommendations.length === 0) {
    return false;
  }

  const verified = extractVerifiedRecommendations(body);
  return verified.length === body.recommendations.length
    && verified.some((recommendation) => recommendation.program_name === recommendedMajor);
}
