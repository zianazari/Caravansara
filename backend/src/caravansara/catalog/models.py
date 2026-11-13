from datetime import date

from sqlalchemy import CHAR, ForeignKey, Identity, Integer, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(SmallInteger, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(CHAR(2))
    name: Mapped[str] = mapped_column(Text)


class Holiday(Base):
    __tablename__ = "holidays"
    country_code: Mapped[str] = mapped_column(CHAR(2), ForeignKey("countries.code"), primary_key=True)
    day: Mapped[date] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    country_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("countries.id"))
    name: Mapped[str] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(Text)


class AmenityCategory(Base):
    __tablename__ = "amenity_categories"

    id: Mapped[int] = mapped_column(SmallInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger)


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(SmallInteger, Identity(always=True), primary_key=True)
    category_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("amenity_categories.id"))
    name: Mapped[str] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)
