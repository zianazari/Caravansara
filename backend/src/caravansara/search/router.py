from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from caravansara.core.db import SessionDep
from caravansara.core.deps import StorageDep
from caravansara.core.errors import error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import SettingsDep
from caravansara.search import service
from caravansara.search.repository import Criteria
from caravansara.search.schemas import FilterCounts, SearchPage, SortBy

router = APIRouter(prefix="/search", tags=["Search"])

_AREA = "Send **either** `city_id` **or** `lat` + `lng` + `radius_km` (1–100 km)."


def criteria(
    settings: SettingsDep,
    city_id: Annotated[int | None, Query(description="City mode.", examples=[1])] = None,
    lat: Annotated[
        float | None, Query(ge=-90, le=90, description="Radial mode: centre latitude.", examples=[52.37])
    ] = None,
    lng: Annotated[
        float | None, Query(ge=-180, le=180, description="Radial mode: centre longitude.", examples=[4.89])
    ] = None,
    radius_km: Annotated[float | None, Query(gt=0, description="Radial mode: radius, 1–100 km.", examples=[5])] = None,
    check_in: Annotated[date | None, Query(description="With check_out: only listings free for these nights.")] = None,
    check_out: Annotated[date | None, Query()] = None,
    adults: Annotated[int, Query(ge=1, le=50)] = 1,
    children: Annotated[int, Query(ge=0, le=50)] = 0,
    infants: Annotated[int, Query(ge=0, le=10, description="Accepted for the UI; infants don't count.")] = 0,
    pets: Annotated[int, Query(ge=0, le=10)] = 0,
    amenity_ids: Annotated[
        list[int], Query(description="Repeat the parameter; listings must have **all** of them.")
    ] = [],  # noqa: B006 (FastAPI copies query defaults)
) -> Criteria:
    return service.build_criteria(
        settings,
        city_id=city_id,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        children=children,
        pets=pets,
        amenity_ids=amenity_ids,
    )


CriteriaDep = Annotated[Criteria, Depends(criteria)]


@router.get(
    "/listings",
    summary="Search listings",
    description=(
        f"{_AREA}\n\nResults show only the approximate public pin. Default order is rating then "
        "review count; `sort=distance` works in radial mode."
    ),
    responses=error_responses(422),
)
async def search_listings(
    c: CriteriaDep,
    session: SessionDep,
    storage: StorageDep,
    page: PageDep,
    sort: Annotated[SortBy, Query()] = "rating",
) -> SearchPage:
    return await service.search(session, storage, c, sort, page.limit, page.offset)


@router.get(
    "/filters",
    summary="Amenity counts for the filter panel",
    description=f"{_AREA}\n\nCounts over listings matching every filter except amenities.",
    responses=error_responses(422),
)
async def filters(c: CriteriaDep, session: SessionDep) -> FilterCounts:
    return await service.filter_counts(session, c)
