from typing import Annotated

from fastapi import APIRouter, Query

from caravansara.catalog import service
from caravansara.catalog.schemas import AmenityCategoryOut, CityOut, CountryOut
from caravansara.core.db import SessionDep
from caravansara.core.errors import error_responses

router = APIRouter(tags=["Catalog"])


@router.get("/countries", summary="Countries")
async def list_countries(session: SessionDep) -> list[CountryOut]:
    return await service.list_countries(session)


@router.get(
    "/cities",
    summary="Cities (autocomplete)",
    description="Cities whose name starts with `q`, optionally within one country.",
    responses=error_responses(422),
)
async def list_cities(
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=100, description="Start of the city name.", examples=["Ams"])] = None,
    country: Annotated[
        str | None, Query(min_length=2, max_length=2, description="ISO country code.", examples=["NL"])
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[CityOut]:
    return await service.search_cities(session, q, country, limit)


@router.get("/amenities", summary="Amenity catalog", description="Amenities grouped by category.")
async def list_amenities(session: SessionDep) -> list[AmenityCategoryOut]:
    return await service.list_amenities(session)
