from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from caravansara.bookings.schemas import BookingOut

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


class AdminBookingOut(BookingOut):
    """A booking in the admin's list (feature 051): the guest's own view without the address, plus who the
    guest is, so the admin can answer a question about it."""

    guest_name: str
    guest_email: str


class AdminBookingPage(BaseModel):
    items: list[AdminBookingOut]
    has_more: bool = Field(description="A next page exists. The totals per status are in `GET /admin/summary`.")


class BookingCounts(BaseModel):
    pending: int = Field(description="Held, not paid yet.")
    confirmed: int
    completed: int
    cancelled: int
    expired: int = Field(description="Not paid in time.")


class AdminSummary(BaseModel):
    """The numbers on the admin panel's tabs (feature 051), asked once when the panel opens."""

    pending_listings: int = Field(description="Listings waiting for review.")
    users: int = Field(description="All accounts.")
    bookings: BookingCounts


AdminBookingSort = Literal["id", "listing", "guest", "dates", "total_price", "status", "created_at"]
AdminQueueSort = Literal["submitted_at", "title", "city", "host"]
