from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

ReviewVersion = Annotated[int, Field(ge=0, description="`review_version` from the queue or the listing details.")]
# FR-005: a written reason; spaces alone are not one. The same rule is a CHECK in the database.
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(
        json_schema_extra={"example": {"email": "admin@example.com", "password": "caravansara-demo"}}
    )


class DecisionIn(BaseModel):
    review_version: ReviewVersion

    model_config = ConfigDict(json_schema_extra={"example": {"review_version": 3}})


class RejectIn(BaseModel):
    review_version: ReviewVersion
    reason: Reason = Field(description="Shown to the host as written. 1 to 1000 characters.")

    model_config = ConfigDict(
        json_schema_extra={"example": {"review_version": 3, "reason": "The photos are not of this flat."}}
    )
