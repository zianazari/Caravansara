# Contract: ابزار ساخت داده برای تست‌های بکند

ماژول: `backend/tests/factories.py`. fixture: `factory` در `backend/tests/conftest.py`.

این ابزار فقط داخل تست‌ها به کار می‌رود و بخشی از بسته‌ی `caravansara` نیست.

```python
class Factory:
    def __init__(self, client: AsyncClient, engine: AsyncEngine) -> None: ...

    async def user(self, name: str = "user") -> User: ...
    async def listing(self, host: User | None = None, **overrides: Any) -> dict[str, Any]: ...
    async def booking(
        self,
        *,
        status: str = "confirmed",            # pending | confirmed | cancelled | expired | completed
        check_in: date | int = 10,            # date، یا تعداد روز از امروز (منفی = گذشته)
        check_out: date | int | None = None,  # پیش‌فرض: check_in + 3 شب
        listing: dict[str, Any] | int | None = None,   # پاسخ API، یا فقط شناسه
        guest: User | int | None = None,               # User، یا فقط شناسه
        hold_expires_at: datetime | None = None,
        adults: int = 1,
    ) -> Booking: ...
    async def stay(self, *, ended_days_ago: int = 1, nights: int = 2) -> Stay: ...
    async def expire_hold(self, booking_id: int, ago: timedelta = timedelta(minutes=1)) -> None: ...


@dataclass(frozen=True)
class Booking:
    id: int
    listing_id: int
    guest_id: int
    host: User | None   # وقتی factory آگهی را ساخته باشد


@dataclass(frozen=True)
class Stay:
    host: User
    guest: User
    listing: dict[str, Any]
    booking_id: int
```

قول‌ها:

1. هر فراخوانی چیزهایی را که نگرفته، خودش می‌سازد. `booking()` بدون آرگومان، میزبان، آگهی، مهمان و رزرو می‌سازد.
2. هیچ قید یا triggerی دور زده نمی‌شود. رزرو هم‌پوشان همان `IntegrityError` با SQLSTATE `23P01` را می‌دهد که API می‌گیرد.
3. به داده‌ی دمو وابسته نیست، و روی پایگاه داده‌ای که فقط catalog دارد کار می‌کند.
4. پاک‌سازی همان `TRUNCATE` خودکار `conftest._clean` بعد از هر تست است.
5. `listing` و `guest` شناسه هم می‌پذیرند، چون تست‌های موجود شناسه نگه می‌دارند. این تغییر هنگام پیاده‌سازی برای کوچک ماندن انتقال اضافه شد.
6. `helpers.insert_booking` حذف می‌شود، و تست‌هایی که آن را صدا می‌زنند به `factory.booking` منتقل می‌شوند. `helpers.register`، `create_listing` و `reserve` می‌مانند، چون رفتار API را می‌آزمایند، نه ساخت داده را.
