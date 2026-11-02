"""Catalog endpoints, health, Swagger/OpenAPI and the error shape."""

from httpx import AsyncClient


async def test_countries(client: AsyncClient) -> None:
    r = await client.get("/countries")
    assert [c["code"] for c in r.json()] == ["DK", "NL", "PT", "SE"]


async def test_city_autocomplete(client: AsyncClient) -> None:
    r = await client.get("/cities", params={"q": "ams"})
    assert [c["name"] for c in r.json()] == ["Amsterdam"]
    assert r.json()[0]["timezone"] == "Europe/Amsterdam"
    assert r.json()[0]["country"]["code"] == "NL"
    by_country = await client.get("/cities", params={"country": "se"})
    assert [c["name"] for c in by_country.json()] == ["Stockholm"]
    wildcard = await client.get("/cities", params={"q": "%"})
    assert wildcard.json() == []  # LIKE wildcards are escaped


async def test_amenities_are_grouped(client: AsyncClient) -> None:
    r = await client.get("/amenities")
    categories = r.json()
    assert len(categories) == 12
    assert sum(len(c["amenities"]) for c in categories) == 31
    assert categories[0]["name"] == "Bathroom"


async def test_health(client: AsyncClient) -> None:
    r = await client.get("http://test/health")
    assert r.json() == {"status": "ok", "database": "ok"}


async def test_swagger_and_openapi(client: AsyncClient) -> None:
    docs = await client.get("http://test/docs")
    assert docs.status_code == 200
    assert "swagger-ui" in docs.text
    assert (await client.get("http://test/redoc")).status_code == 200
    root = await client.get("http://test/")
    assert root.status_code == 307
    assert root.headers["location"] == "/docs"

    spec = (await client.get("/openapi.json")).json()
    assert spec["info"]["title"] == "Caravansara API"
    assert spec["components"]["securitySchemes"]["HTTPBearer"]["scheme"] == "bearer"
    assert "ErrorResponse" in spec["components"]["schemas"]
    booking = spec["paths"]["/api/v1/bookings"]["post"]
    assert {"200", "201", "409", "422"} <= set(booking["responses"])
    assert any(p["name"] == "Idempotency-Key" for p in booking["parameters"])
    assert {t["name"] for t in spec["tags"]} >= {"Bookings", "Search", "Listings"}


async def test_unknown_route_uses_the_error_shape(client: AsyncClient) -> None:
    r = await client.get("/nope")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "not_found", "message": "Not Found"}}
    wrong_method = await client.delete("/countries")
    assert wrong_method.json()["error"]["code"] == "method_not_allowed"
