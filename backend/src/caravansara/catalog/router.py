from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from caravansara.catalog import service
from caravansara.catalog.schemas import AmenityCategoryOut, CityOut, CountryOut, HolidayOut
from caravansara.core.db import SessionDep
from caravansara.core.errors import error_responses
from caravansara.search import service as search

router = APIRouter(tags=["Catalog"])


@router.get("/holidays", summary="Shared holiday calendar", responses=error_responses(422))
async def list_holidays(
    session: SessionDep, start: date, end: date, country: Annotated[str, Query(min_length=2, max_length=2)] = "IR"
) -> list[HolidayOut]:
    return await service.holidays(session, country, start, end)


# `popular` (feature 030): the counts come from search, which reads across listings and bookings.
CitySort = Literal["name", "popular"]


@router.get("/countries", summary="Countries")
async def list_countries(session: SessionDep) -> list[CountryOut]:
    return await service.list_countries(session)


@router.get(
    "/cities",
    summary="Cities (autocomplete)",
    description=(
        "Cities whose name starts with `q`, optionally within one country. `sort=popular` puts the cities "
        "with the most bookings in the last 90 days first (counts refreshed every 10 minutes)."
    ),
    responses=error_responses(422),
)
async def list_cities(
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=100, description="Start of the city name.", examples=["Ams"])] = None,
    country: Annotated[
        str | None, Query(min_length=2, max_length=2, description="ISO country code.", examples=["NL"])
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    sort: Annotated[CitySort, Query(description="`name` (A to Z) or `popular` (most booked first).")] = "name",
) -> list[CityOut]:
    counts = await search.bookings_per_city(session) if sort == "popular" else None
    return await service.search_cities(session, q, country, limit, counts)


@router.get("/amenities", summary="Amenity catalog", description="Amenities grouped by category.")
async def list_amenities(session: SessionDep) -> list[AmenityCategoryOut]:
    return await service.list_amenities(session)
