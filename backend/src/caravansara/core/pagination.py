"""limit/offset paging shared by list endpoints."""

from typing import Annotated

from fastapi import Depends, Query
from pydantic import BaseModel


class Page(BaseModel):
    limit: int
    offset: int


def _page(
    limit: Annotated[int, Query(ge=1, le=100, description="Items per page.")] = 20,
    offset: Annotated[int, Query(ge=0, description="Items to skip.")] = 0,
) -> Page:
    return Page(limit=limit, offset=offset)


PageDep = Annotated[Page, Depends(_page)]


class PageInfo(BaseModel):
    total: int
    limit: int
    offset: int
