from datetime import date

from pydantic import BaseModel, Field


class HolidayIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class HolidayOut(HolidayIn):
    country_code: str
    day: date


class CountryOut(BaseModel):
    id: int
    code: str
    name: str


class CityOut(BaseModel):
    id: int
    name: str
    timezone: str
    country: CountryOut


class AmenityOut(BaseModel):
    id: int
    name: str
    icon: str | None


class AmenityCategoryOut(BaseModel):
    id: int
    name: str
    amenities: list[AmenityOut]
