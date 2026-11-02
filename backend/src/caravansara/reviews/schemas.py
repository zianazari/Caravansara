from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Stars = Annotated[int, Field(ge=1, le=5)]


class ReviewCreate(BaseModel):
    rating: Stars
    cleanliness_rating: Stars | None = None
    accuracy_rating: Stars | None = None
    check_in_rating: Stars | None = None
    communication_rating: Stars | None = None
    location_rating: Stars | None = None
    value_rating: Stars | None = None
    comment: str = Field(min_length=1, max_length=5000)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "rating": 5,
                "cleanliness_rating": 5,
                "accuracy_rating": 4,
                "check_in_rating": 5,
                "communication_rating": 5,
                "location_rating": 5,
                "value_rating": 4,
                "comment": "Lovely place, great host.",
            }
        }
    )


class ReviewAuthor(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None


class ReviewOut(BaseModel):
    id: int
    booking_id: int
    listing_id: int
    author: ReviewAuthor
    rating: int
    cleanliness_rating: int | None
    accuracy_rating: int | None
    check_in_rating: int | None
    communication_rating: int | None
    location_rating: int | None
    value_rating: int | None
    comment: str
    created_at: datetime


class ReviewPage(BaseModel):
    items: list[ReviewOut]
    total: int
