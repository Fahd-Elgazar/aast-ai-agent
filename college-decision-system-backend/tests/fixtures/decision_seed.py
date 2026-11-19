from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.infrastructure.db.models.decision_college import (
    DecisionAcceptedCertificateModel,
    DecisionAdmissionRequirementModel,
    DecisionCollegeLevelProfileModel,
    DecisionCollegeModel,
    DecisionTrainingAndPracticeModel,
)
from app.infrastructure.db.models.decision_fee import (
    DecisionFeeAmountModel,
    DecisionFeeCategoryRuleModel,
    DecisionFeeItemModel,
    DecisionFeeRuleCollegeModel,
    DecisionFeeRuleThresholdModel,
)
from app.infrastructure.db.models.decision_program import (
    DecisionEmploymentOutlookModel,
    DecisionProgramCareerPathModel,
    DecisionProgramDecisionProfileModel,
    DecisionProgramModel,
)


SYNTHETIC_PROGRAMS: tuple[dict[str, object], ...] = (
    {
        "college_id": "SYNTH_COMPUTING_COLLEGE",
        "college_name": "Synthetic College of Computing",
        "city": "Sample City",
        "program_id": "SYNTH_ARTIFICIAL_INTELLIGENCE",
        "program_name": "Artificial Intelligence",
        "program_family": "Computing",
        "summary": "Artificial intelligence, machine learning, data science, software, and programming.",
        "career_title": "Machine Learning Engineer",
        "fee": Decimal("4500.00"),
        "profile": {
            "ai_focus": Decimal("0.95"),
            "data_focus": Decimal("0.90"),
            "software_focus": Decimal("0.90"),
            "programming_intensity": Decimal("0.90"),
            "career_flexibility": Decimal("0.85"),
            "math_intensity": Decimal("0.70"),
        },
    },
    {
        "college_id": "SYNTH_BUSINESS_COLLEGE",
        "college_name": "Synthetic College of Business and Logistics",
        "city": "El Alamein",
        "program_id": "SYNTH_BUSINESS_MANAGEMENT",
        "program_name": "Business Management and Logistics",
        "program_family": "Business",
        "summary": "Business management, finance, entrepreneurship, supply chain, trade, and logistics.",
        "career_title": "Business and Logistics Analyst",
        "fee": Decimal("2500.00"),
        "profile": {
            "business_focus": Decimal("0.95"),
            "finance_focus": Decimal("0.85"),
            "management_exposure": Decimal("0.95"),
            "entrepreneurship_focus": Decimal("0.85"),
            "logistics_focus": Decimal("0.95"),
            "international_trade_focus": Decimal("0.85"),
            "transport_operations_focus": Decimal("0.80"),
            "maritime_focus": Decimal("0.70"),
            "career_flexibility": Decimal("0.90"),
        },
    },
    {
        "college_id": "SYNTH_ENGINEERING_COLLEGE",
        "college_name": "Synthetic College of Engineering",
        "city": "New Alamein",
        "program_id": "SYNTH_ENGINEERING_SYSTEMS",
        "program_name": "Engineering Systems",
        "program_family": "Engineering",
        "summary": "Engineering systems with mathematics, physics, electronics, hardware, and energy.",
        "career_title": "Systems Engineer",
        "fee": Decimal("6000.00"),
        "profile": {
            "math_intensity": Decimal("0.95"),
            "physics_intensity": Decimal("0.95"),
            "hardware_focus": Decimal("0.90"),
            "energy_sector_focus": Decimal("0.85"),
            "lab_intensity": Decimal("0.85"),
            "field_work_intensity": Decimal("0.75"),
            "career_flexibility": Decimal("0.80"),
        },
    },
)


def seed_synthetic_decision_data(session: Session) -> None:
    """Seed a fresh migrated database with deterministic, non-private data."""

    if session.query(DecisionCollegeModel).count() or session.query(DecisionProgramModel).count():
        raise RuntimeError("Synthetic decision fixtures require an empty decision database.")

    admission_requirements: list[DecisionAdmissionRequirementModel] = []
    for item in SYNTHETIC_PROGRAMS:
        college_id = str(item["college_id"])
        program_id = str(item["program_id"])

        session.add(
            DecisionCollegeModel(
                id=college_id,
                schema_version="decision_schema_v1",
                entity_type="college",
                college_name=str(item["college_name"]),
                city=str(item["city"]),
                country="Exampleland",
                branch="Synthetic",
                parent_institution="Synthetic University",
                short_description="Synthetic CI fixture; not production or institutional data.",
                current_status="active",
            )
        )
        session.add(
            DecisionCollegeLevelProfileModel(
                college_id=college_id,
                theoretical_depth=Decimal("0.75"),
                math_intensity=Decimal("0.75"),
                practical_intensity=Decimal("0.80"),
                field_work_intensity=Decimal("0.65"),
                research_orientation=Decimal("0.70"),
                career_flexibility=Decimal("0.85"),
                egypt_employability_level="high",
                egypt_employability_score=Decimal("0.85"),
                international_employability_level="high",
                international_employability_score=Decimal("0.80"),
            )
        )
        session.add(
            DecisionTrainingAndPracticeModel(
                college_id=college_id,
                mandatory_training=True,
                industry_training=True,
                field_or_sea_training=True,
                description="Synthetic practical training fixture.",
            )
        )
        admission = DecisionAdmissionRequirementModel(
            college_id=college_id,
            entry_exams_required=False,
            medical_fitness_required=False,
            other_conditions="Synthetic minimum admission threshold only.",
        )
        session.add(admission)
        admission_requirements.append(admission)

        session.add(
            DecisionProgramModel(
                id=program_id,
                college_id=college_id,
                program_name=str(item["program_name"]),
                program_family=str(item["program_family"]),
                degree_type="Undergraduate",
                study_duration_years=Decimal("4.0"),
                summary=str(item["summary"]),
                differentiation_notes="Synthetic fixture for deterministic recommendation tests.",
                min_percentage=Decimal("60.00"),
            )
        )
        session.add(
            DecisionProgramDecisionProfileModel(
                program_id=program_id,
                **item["profile"],
            )
        )
        session.add(
            DecisionProgramCareerPathModel(
                program_id=program_id,
                career_title=str(item["career_title"]),
            )
        )
        session.add(
            DecisionEmploymentOutlookModel(
                program_id=program_id,
                egypt_market_level="high",
                egypt_market_label="Strong synthetic outlook",
                egypt_market_score=Decimal("0.85"),
                international_market_level="high",
                international_market_label="Strong synthetic outlook",
                international_market_score=Decimal("0.80"),
            )
        )

    session.flush()

    for admission in admission_requirements:
        session.add_all(
            [
                DecisionAcceptedCertificateModel(
                    admission_requirement_id=admission.id,
                    certificate_name="Egyptian Thanaweya Amma (Science)",
                    sort_order=0,
                ),
                DecisionAcceptedCertificateModel(
                    admission_requirement_id=admission.id,
                    certificate_name="Egyptian Thanaweya Amma (Math)",
                    sort_order=1,
                ),
            ]
        )

    for item in SYNTHETIC_PROGRAMS:
        fee_item = DecisionFeeItemModel(
            fee_id=f"SYNTH_FEE_{item['program_id']}",
            academic_year="2025/2026",
            currency="USD",
            fee_mode="per_semester",
            branch_scope="all",
            college_id_raw=str(item["college_id"]),
            college_name=str(item["college_name"]),
            program_name=str(item["program_name"]),
            track_type="regular",
            source_college_match_id=str(item["college_id"]),
            source_program_match_id=str(item["program_id"]),
            data_quality_status="synthetic_test_fixture",
            data_quality_note="Tracked synthetic fixture; not a published tuition value.",
        )
        session.add(fee_item)
        session.flush()
        session.add(
            DecisionFeeAmountModel(
                fee_item_id=fee_item.id,
                student_group="other_states",
                fee_category="A",
                amount_usd=item["fee"],
            )
        )

    fee_rule = DecisionFeeCategoryRuleModel(
        rule_id="SYNTHETIC_CATEGORY_A",
        certificate_type="egyptian_secondary_or_nile_or_stem_or_azhar",
        branch_scope="all",
        student_group="other_states",
        data_quality_status="synthetic_test_fixture",
        data_quality_note="Tracked synthetic fixture; not an institutional admission rule.",
    )
    session.add(fee_rule)
    session.flush()

    for sort_order, item in enumerate(SYNTHETIC_PROGRAMS):
        session.add(
            DecisionFeeRuleCollegeModel(
                fee_rule_id=fee_rule.id,
                college_id_raw=str(item["college_id"]),
                source_college_match_id=str(item["college_id"]),
                sort_order=sort_order,
            )
        )
    session.add_all(
        [
            DecisionFeeRuleThresholdModel(
                fee_rule_id=fee_rule.id,
                fee_category="C",
                min_percent=Decimal("0.00"),
                max_percent_exclusive=Decimal("40.00"),
            ),
            DecisionFeeRuleThresholdModel(
                fee_rule_id=fee_rule.id,
                fee_category="B",
                min_percent=Decimal("40.00"),
                max_percent_exclusive=Decimal("50.00"),
            ),
            DecisionFeeRuleThresholdModel(
                fee_rule_id=fee_rule.id,
                fee_category="A",
                min_percent=Decimal("50.00"),
                max_percent_exclusive=Decimal("101.00"),
            ),
        ]
    )
    session.commit()


__all__ = ["SYNTHETIC_PROGRAMS", "seed_synthetic_decision_data"]
