"""Catalog endpoints, health, Swagger/OpenAPI and the error shape."""

from httpx import ASGITransport, AsyncClient

from caravansara.core.config import Settings
from caravansara.main import create_app
from caravansara.search import service as search
from tests.factories import Factory
from tests.helpers import city_id, sql


async def test_countries(client: AsyncClient) -> None:
    r = await client.get("/countries")
    assert [c["code"] for c in r.json()] == ["DK", "IR", "NL", "PT", "SE", "GB", "US"]  # by name


async def test_city_autocomplete(client: AsyncClient) -> None:
    r = await client.get("/cities", params={"q": "ams"})
    assert [c["name"] for c in r.json()] == ["Amsterdam"]
    assert r.json()[0]["timezone"] == "Europe/Amsterdam"
    assert r.json()[0]["country"]["code"] == "NL"
    by_country = await client.get("/cities", params={"country": "se"})
    assert [c["name"] for c in by_country.json()] == ["Stockholm"]
    wildcard = await client.get("/cities", params={"q": "%"})
    assert wildcard.json() == []  # LIKE wildcards are escaped


async def test_popular_cities_come_first(client: AsyncClient, factory: Factory) -> None:
    """Feature 030: most bookings in the last 90 days first, then by name; only public listings count."""
    search.forget_popularity()
    shiraz = await factory.listing(city=await city_id(client, "Shiraz"))
    london = await factory.listing(city=await city_id(client, "London"))
    for n in range(2):
        await factory.booking(listing=shiraz, check_in=10 + 5 * n)
    await factory.booking(listing=london, status="completed", check_in=-5)
    await factory.booking(listing=london, status="cancelled")  # cancelled and expired do not count
    await factory.booking(listing=london, status="expired")
    old = await factory.booking(listing=london, check_in=20)  # made before the 90 days
    await sql(factory.engine, "UPDATE bookings SET created_at = now() - interval '91 days' WHERE id = :id", id=old.id)
    hidden = await factory.listing(city=await city_id(client, "Tehran"), approved=False)
    for n in range(3):
        await factory.booking(listing=hidden, check_in=10 + 5 * n)  # a listing that is not public does not count

    r = await client.get("/cities", params={"sort": "popular", "limit": 4})
    assert [c["name"] for c in r.json()] == ["Shiraz", "London", "Amsterdam", "Copenhagen"]
    iran = await client.get("/cities", params={"sort": "popular", "country": "IR"})
    assert [c["name"] for c in iran.json()] == ["Shiraz", "Isfahan", "Tehran"]
    by_name = await client.get("/cities", params={"limit": 2})
    assert [c["name"] for c in by_name.json()] == ["Amsterdam", "Copenhagen"]  # the default stays A to Z
    bad = await client.get("/cities", params={"sort": "busy"})
    assert bad.status_code == 422
    search.forget_popularity()


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


async def test_cors_allows_only_configured_origins(prepared: Settings) -> None:
    app = create_app(prepared.model_copy(update={"cors_origins": ["https://app.example.com"]}))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"}
        allowed = await client.options("/api/v1/bookings", headers={"Origin": "https://app.example.com", **preflight})
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "https://app.example.com"
        other = await client.options("/api/v1/bookings", headers={"Origin": "https://evil.example.com", **preflight})
        assert "access-control-allow-origin" not in other.headers


async def test_no_cors_headers_by_default(client: AsyncClient) -> None:
    r = await client.options(
        "/bookings", headers={"Origin": "https://app.example.com", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in r.headers
