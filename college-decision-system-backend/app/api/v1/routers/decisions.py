from decimal import Decimal

from fastapi import APIRouter, Depends

from app.api.v1.dependencies.security import verify_internal_secret
from app.api.v1.schemas.agent_decision import (
    AgentRecommendRequestSchema,
    AgentRecommendResponseSchema,
)
from app.api.v1.schemas.decision import (
    DecisionDataCompletenessSchema,
    FeeDetailsSchema,
    FeeLineItemSchema,
    ProgramRecommendationSchema,
    RecommendProgramsRequestSchema,
    RecommendProgramsResponseSchema,
)
from app.application.services.fee_category_resolver import FeeCategoryResolver
from app.application.services.training_intensity_deriver import TrainingIntensityDeriver
from app.application.services.tuition_calculator import TuitionCalculator
from app.application.use_cases.recommend_programs import (
    RecommendProgramsRequest,
    RecommendProgramsUseCase,
)
from app.infrastructure.db.repositories.decision_college_repo import DecisionCollegeRepository
from app.infrastructure.db.repositories.decision_fee_repo import DecisionFeeRepository
from app.infrastructure.db.repositories.decision_program_repo import DecisionProgramRepository
from app.infrastructure.db.session import SessionLocal


router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post(
    "/recommend",
    response_model=AgentRecommendResponseSchema | RecommendProgramsResponseSchema,
    summary="Recommend programs for AI Agent",
    dependencies=[Depends(verify_internal_secret)],
)
def recommend_programs(payload: AgentRecommendRequestSchema | RecommendProgramsRequestSchema):
    db = SessionLocal()
    try:
        college_repo = DecisionCollegeRepository(db)
        program_repo = DecisionProgramRepository(db)
        fee_repo = DecisionFeeRepository(db)

        use_case = RecommendProgramsUseCase(
            college_repository=college_repo,
            program_repository=program_repo,
            fee_category_resolver=FeeCategoryResolver(
                program_repository=program_repo,
                fee_repository=fee_repo,
            ),
            tuition_calculator=TuitionCalculator(fee_repository=fee_repo),
            training_intensity_deriver=TrainingIntensityDeriver(),
        )

        if isinstance(payload, RecommendProgramsRequestSchema):
            result = use_case.execute(
                RecommendProgramsRequest(
                    certificate_type=payload.certificate_type,
                    high_school_percentage=(
                        Decimal(str(payload.high_school_percentage))
                        if payload.high_school_percentage is not None
                        else None
                    ),
                    student_group=payload.student_group or "other_states",
                    budget=(
                        Decimal(str(payload.budget))
                        if payload.budget is not None
                        else None
                    ),
                    preferred_branch=payload.preferred_branch,
                    preferred_city=payload.preferred_city,
                    interests=payload.interests,
                    track_type=payload.track_type,
                    max_results=payload.max_results,
                    min_results=payload.min_results,
                )
            )

            recs = []
            for rec in result.recommendations:
                add_recurring_fees = _serialize_decimal(rec.fee_details.additional_recurring_fees_total)
                add_one_time_fees = _serialize_decimal(rec.fee_details.additional_one_time_fees_total)

                completeness = DecisionDataCompletenessSchema(
                    has_profile=rec.decision_data_completeness.has_profile,
                    has_training_data=rec.decision_data_completeness.has_training_data,
                    has_employment_data=rec.decision_data_completeness.has_employment_data,
                    has_admission_data=rec.decision_data_completeness.has_admission_data,
                    completeness_score=float(rec.decision_data_completeness.completeness_score),
                    missing_fields=rec.decision_data_completeness.missing_fields,
                    warnings=rec.decision_data_completeness.warnings,
                )

                fee_details = FeeDetailsSchema(
                    fee_category=rec.fee_category,
                    fee_category_confidence=rec.fee_category_confidence,
                    fee_resolution_reason=rec.fee_resolution_reason,
                    fee_match_level=rec.fee_match_level,
                    fee_match_source=rec.fee_match_source,
                    fee_match_confidence=rec.fee_match_confidence,
                    estimated_semester_fee=_serialize_decimal(rec.estimated_semester_fee),
                    recurring_total=_serialize_decimal(rec.fee_details.recurring_total),
                    additional_recurring_fees_total=add_recurring_fees,
                    additional_recurring_fees_breakdown=_serialize_fee_lines(rec.fee_details.additional_recurring_fees_breakdown),
                    additional_one_time_fees_total=add_one_time_fees,
                    additional_one_time_fees_breakdown=_serialize_fee_lines(rec.fee_details.additional_one_time_fees_breakdown),
                    unknown_frequency_fees_total=_serialize_decimal(rec.fee_details.unknown_frequency_fees_total),
                    unknown_frequency_fees_breakdown=_serialize_fee_lines(rec.fee_details.unknown_frequency_fees_breakdown),
                    currency=rec.currency,
                    academic_year=rec.academic_year,
                    fee_mode=rec.fee_mode,
                    tuition_unavailable=rec.tuition_unavailable,
                    fee_data_incomplete=rec.fee_data_incomplete,
                    used_college_fallback=rec.used_college_fallback,
                    warnings=rec.warnings,
                    fee_resolution_note=rec.fee_resolution_note,
                )

                recs.append(
                    ProgramRecommendationSchema(
                        program_id=rec.program_id,
                        program_name=rec.program_name,
                        college_id=rec.college_id,
                        college_name=rec.college_name,
                        confidence_level=rec.confidence_level,
                        score=float(rec.score),
                        recommendation_score=float(rec.score),
                        match_type=rec.match_type,
                        fee_category=rec.fee_category,
                        fee_category_confidence=rec.fee_category_confidence,
                        fee_resolution_reason=rec.fee_resolution_reason,
                        matched_fee_category=rec.matched_fee_category,
                        estimated_semester_fee=_serialize_decimal(rec.estimated_semester_fee),
                        additional_recurring_fees=add_recurring_fees,
                        additional_one_time_fees=add_one_time_fees,
                        additional_one_time_fees_total=add_one_time_fees,
                        additional_one_time_fees_breakdown=_serialize_fee_lines(rec.additional_one_time_fees_breakdown),
                        one_time_fees=add_one_time_fees,
                        currency=rec.currency,
                        academic_year=rec.academic_year,
                        fee_mode=rec.fee_mode,
                        fee_match_level=rec.fee_match_level,
                        fee_match_source=rec.fee_match_source,
                        fee_match_confidence=rec.fee_match_confidence,
                        tuition_unavailable=rec.tuition_unavailable,
                        fee_data_incomplete=rec.fee_data_incomplete,
                        used_college_fallback=rec.used_college_fallback,
                        warnings=rec.warnings,
                        affordability_label=rec.affordability_label,
                        training_intensity=rec.derived_training_intensity_label,
                        derived_training_intensity_label=rec.derived_training_intensity_label,
                        score_breakdown=rec.score_breakdown,
                        explanation_summary=rec.explanation_summary,
                        matched_interests=rec.matched_interests,
                        fee_resolution_note=rec.fee_resolution_note,
                        fee_details=fee_details,
                        decision_data_completeness=completeness,
                        location_note=rec.location_note,
                    )
                )

            return RecommendProgramsResponseSchema(
                total_candidates_considered=result.total_candidates_considered,
                recommendations=recs,
            )

        all_interests = payload.preferences.interests + payload.preferences.career_goals

        result = use_case.execute(
            RecommendProgramsRequest(
                certificate_type=payload.student_profile.certificate_type,
                high_school_percentage=(
                    Decimal(str(payload.student_profile.high_school_percentage))
                    if payload.student_profile.high_school_percentage is not None
                    else None
                ),
                student_group="other_states",  # Default if missing
                budget=(
                    Decimal(str(payload.student_profile.budget))
                    if payload.student_profile.budget is not None
                    else None
                ),
                preferred_branch=None,
                preferred_city=None,
                interests=list(set(all_interests)),
                track_type=payload.student_profile.track_type,
                max_results=5,
                min_results=3,
            )
        )

        if not result.recommendations:
            return AgentRecommendResponseSchema(
                recommended_major="None",
                confidence=0.0,
                reason="No programs found matching the given criteria.",
                score_breakdown={},
                warnings=["Consider broadening your interests or increasing your budget."]
            )

        top_match = result.recommendations[0]

        return AgentRecommendResponseSchema(
            recommended_major=top_match.program_name,
            confidence=float(top_match.score),
            reason=top_match.explanation_summary,
            score_breakdown=top_match.score_breakdown,
            warnings=top_match.warnings
        )
    finally:
        db.close()


def _serialize_decimal(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _serialize_fee_lines(lines) -> list[FeeLineItemSchema]:
    return [
        FeeLineItemSchema(
            fee_type=line.fee_type,
            amount=float(line.amount),
            frequency=line.frequency,
            note=line.note,
        )
        for line in lines
    ]
