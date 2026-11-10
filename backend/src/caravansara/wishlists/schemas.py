from datetime import datetime

from pydantic import BaseModel, Field

from caravansara.listings.schemas import ListingCard


class WishlistItemOut(BaseModel):
    listing_id: int
    saved_at: datetime
    available: bool = Field(description="False when the listing is no longer public (off, or back in review).")
    listing: ListingCard | None = Field(description="The listing's card; null when it is not available.")


class WishlistPage(BaseModel):
    items: list[WishlistItemOut]
    total: int


class WishlistIds(BaseModel):
    listing_ids: list[int] = Field(description="Every saved listing, newest first, to mark the hearts on cards.")
