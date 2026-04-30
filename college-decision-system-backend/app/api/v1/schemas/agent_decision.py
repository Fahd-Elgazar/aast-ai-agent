from pydantic import BaseModel, ConfigDict, Field
from typing import Dict, Any

class StudentProfileSchema(BaseModel):
    certificate_type: str | None = None
    high_school_percentage: float | None = None
    budget: float | None = None
    track_type: str = "regular"

class PreferencesSchema(BaseModel):
    interests: list[str] = Field(default_factory=list)
    career_goals: list[str] = Field(default_factory=list)

class AgentRecommendRequestSchema(BaseModel):
    student_profile: StudentProfileSchema
    preferences: PreferencesSchema
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "student_profile": {
                    "certificate_type": "string",
                    "high_school_percentage": 85,
                    "budget": 50000,
                    "track_type": "regular"
                },
                "preferences": {
                    "interests": ["AI", "Programming"],
                    "career_goals": ["Data Science"]
                }
            }
        }
    )

class AgentRecommendResponseSchema(BaseModel):
    recommended_major: str
    confidence: float
    reason: str
    score_breakdown: Dict[str, Any]
    warnings: list[str]
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "recommended_major": "string",
                "confidence": 0.0,
                "reason": "string",
                "score_breakdown": {},
                "warnings": []
            }
        }
    )
