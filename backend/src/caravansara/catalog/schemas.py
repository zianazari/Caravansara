from pydantic import BaseModel


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
