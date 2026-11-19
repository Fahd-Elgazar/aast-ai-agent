from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.v1.schemas.decision import ProgramRecommendationSchema

class StudentProfileSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    certificate_type: str | None = None
    high_school_percentage: float | None = Field(default=None, ge=0, le=100)
    budget: float | None = Field(default=None, ge=0)
    track_type: str = "regular"
    preferred_branch: str | None = None
    preferred_city: str | None = None

class PreferencesSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    interests: list[str] = Field(default_factory=list)
    career_goals: list[str] = Field(default_factory=list)

class AgentRecommendRequestSchema(BaseModel):
    student_profile: StudentProfileSchema
    preferences: PreferencesSchema
    
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "student_profile": {
                    "certificate_type": "string",
                    "high_school_percentage": 85,
                    "budget": 50000,
                    "track_type": "regular",
                    "preferred_branch": "heliopolis",
                    "preferred_city": "cairo"
                },
                "preferences": {
                    "interests": ["AI", "Programming"],
                    "career_goals": ["Data Science"]
                }
            }
        }
    )

class AgentRecommendResponseSchema(BaseModel):
    success: bool = True
    result_status: Literal["ok", "no_results"]
    recommended_major: str | None = None
    confidence: float | None = None
    reason: str
    score_breakdown: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)
    total_candidates_considered: int
    recommendations: list[ProgramRecommendationSchema] = Field(default_factory=list)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "result_status": "ok",
                "recommended_major": "string",
                "confidence": 0.0,
                "reason": "string",
                "score_breakdown": {},
                "warnings": [],
                "total_candidates_considered": 1,
                "recommendations": [],
            }
        }
    )
