"""The taken nights of a listing, for the calendar on its page (feature 019)."""

from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.factories import Factory
from tests.helpers import reserve


def day(n: int) -> date:
    return date.today() + timedelta(days=n)


async def test_confirmed_stays_and_running_holds_take_their_nights(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    listing = await factory.listing()
    lid = listing["id"]
    paid_guest = await factory.user("paid")
    paid = (await reserve(client, paid_guest, lid, 30, 33)).json()
    await client.post(f"/bookings/{paid['id']}/pay", headers=paid_guest.auth)
    held = (await reserve(client, await factory.user("held"), lid, 40, 42)).json()  # unpaid, still running
    expired = (await reserve(client, await factory.user("late"), lid, 50, 52)).json()
    await factory.expire_hold(expired["id"])  # ran out: free again
    cancelled_guest = await factory.user("cancel")
    cancelled = (await reserve(client, cancelled_guest, lid, 60, 62)).json()
    await client.post(f"/bookings/{cancelled['id']}/cancel", headers=cancelled_guest.auth)

    r = await client.get(f"/listings/{lid}/availability", params={"start": str(day(0)), "end": str(day(90))})
    assert r.status_code == 200, r.text
    nights = r.json()["booked_nights"]
    assert nights == [str(day(n)) for n in (30, 31, 32, 40, 41)]  # check-out days stay free
    assert held["id"]  # the hold above is what takes 40 and 41


async def test_the_window_cuts_a_stay_and_defaults_to_a_year(client: AsyncClient, factory: Factory) -> None:
    listing = await factory.listing()
    guest = await factory.user("guest")
    await reserve(client, guest, listing["id"], 30, 35)
    cut = (
        await client.get(f"/listings/{listing['id']}/availability", params={"start": str(day(32)), "end": str(day(34))})
    ).json()
    assert cut["booked_nights"] == [str(day(32)), str(day(33))]
    whole = (await client.get(f"/listings/{listing['id']}/availability")).json()
    assert (date.fromisoformat(whole["end"]) - date.fromisoformat(whole["start"])).days == 365
    assert len(whole["booked_nights"]) == 5


async def test_it_shows_no_guest_and_follows_the_page_s_visibility(client: AsyncClient, factory: Factory) -> None:
    waiting = await factory.listing(approved=False)
    assert (await client.get(f"/listings/{waiting['id']}/availability")).status_code == 404
    listing = await factory.listing()
    body = (await client.get(f"/listings/{listing['id']}/availability")).json()
    assert set(body) == {"start", "end", "booked_nights"}


async def test_a_wrong_window_is_refused(client: AsyncClient, factory: Factory) -> None:
    listing = await factory.listing()
    for start, end in ((day(10), day(5)), (day(0), day(401))):
        r = await client.get(f"/listings/{listing['id']}/availability", params={"start": str(start), "end": str(end)})
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "invalid_dates"
