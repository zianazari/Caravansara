"""Initial schema: 12 tables from db/schema.sql (backend design, 2026-11-01).

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Copied from db/schema.sql without comments; see that file for the reasons behind each rule.
# One statement per op.execute: asyncpg runs a single command per call.
STATEMENTS = [
    """
CREATE EXTENSION IF NOT EXISTS btree_gist
""",
    """
CREATE EXTENSION IF NOT EXISTS postgis
""",
    """
CREATE TYPE property_type  AS ENUM ('entire_place', 'private_room', 'shared_room')
""",
    """
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'expired', 'completed')
""",
    """
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT        NOT NULL,
    password_hash  TEXT        NOT NULL,
    full_name      TEXT        NOT NULL,
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)
""",
    """
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email))
""",
    """
CREATE TABLE refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    CHECK (expires_at > created_at)
)
""",
    """
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL
""",
    """
CREATE TABLE auth_attempts (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action        TEXT        NOT NULL CHECK (action IN ('login', 'register')),
    identifier    TEXT        NOT NULL,
    succeeded     BOOLEAN     NOT NULL,
    attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
""",
    """
CREATE INDEX auth_attempts_lookup_idx ON auth_attempts (action, identifier, attempted_at DESC)
""",
    """
CREATE TABLE countries (
    id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  CHAR(2) NOT NULL UNIQUE,
    name  TEXT    NOT NULL UNIQUE
)
""",
    """
CREATE TABLE cities (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_id  SMALLINT NOT NULL REFERENCES countries(id),
    name        TEXT     NOT NULL,
    timezone    TEXT     NOT NULL,
    UNIQUE (country_id, name)
)
""",
    """
CREATE TABLE listings (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    host_id          BIGINT        NOT NULL REFERENCES users(id),
    title            TEXT          NOT NULL,
    description      TEXT,
    property_type    property_type NOT NULL,
    city_id          INT           NOT NULL REFERENCES cities(id),
    neighborhood     TEXT,
    address          TEXT          NOT NULL,
    latitude         NUMERIC(9,6)  NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude        NUMERIC(9,6)  NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    public_location  geography(Point, 4326) NOT NULL,
    max_guests       SMALLINT      NOT NULL CHECK (max_guests >= 1),
    pets_allowed     BOOLEAN       NOT NULL DEFAULT false,
    max_pets         SMALLINT      NOT NULL DEFAULT 0 CHECK (max_pets >= 0),
    bedrooms         SMALLINT      NOT NULL DEFAULT 0 CHECK (bedrooms  >= 0),
    beds             SMALLINT      NOT NULL DEFAULT 1 CHECK (beds      >= 0),
    bathrooms        NUMERIC(3,1)  NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
    price_per_night  NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
    cleaning_fee     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    currency         CHAR(3)       NOT NULL DEFAULT 'EUR',
    check_in_time    TIME          NOT NULL DEFAULT '15:00',
    check_out_time   TIME          NOT NULL DEFAULT '11:00',
    avg_rating       NUMERIC(3,2)  CHECK (avg_rating BETWEEN 1 AND 5),
    review_count     INT           NOT NULL DEFAULT 0,
    is_active        BOOLEAN       NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CHECK (pets_allowed OR max_pets = 0)
)
""",
    """
CREATE INDEX listings_city_idx   ON listings (city_id) WHERE is_active
""",
    """
CREATE INDEX listings_host_idx   ON listings (host_id)
""",
    """
CREATE INDEX listings_public_location_idx ON listings USING gist (public_location) WHERE is_active
""",
    """
CREATE TABLE listing_photos (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id  BIGINT   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    storage_key TEXT     NOT NULL UNIQUE,
    width       INT      NOT NULL CHECK (width  > 0),
    height      INT      NOT NULL CHECK (height > 0),
    caption     TEXT,
    room_tag    TEXT,
    sort_order  SMALLINT NOT NULL,
    CONSTRAINT listing_photos_order_key UNIQUE (listing_id, sort_order) DEFERRABLE INITIALLY DEFERRED
)
""",
    """
CREATE TABLE amenity_categories (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT     NOT NULL UNIQUE,
    sort_order  SMALLINT NOT NULL DEFAULT 0
)
""",
    """
CREATE TABLE amenities (
    id           SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id  SMALLINT NOT NULL REFERENCES amenity_categories(id),
    name         TEXT     NOT NULL UNIQUE,
    icon         TEXT
)
""",
    """
CREATE TABLE listing_amenities (
    listing_id  BIGINT   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    amenity_id  SMALLINT NOT NULL REFERENCES amenities(id),
    PRIMARY KEY (listing_id, amenity_id)
)
""",
    """
CREATE INDEX listing_amenities_amenity_idx ON listing_amenities (amenity_id)
""",
    """
CREATE TABLE bookings (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id       BIGINT         NOT NULL REFERENCES listings(id),
    guest_id         BIGINT         NOT NULL REFERENCES users(id),
    check_in         DATE           NOT NULL,
    check_out        DATE           NOT NULL,
    stay             DATERANGE      GENERATED ALWAYS AS (daterange(check_in, check_out, '[)')) STORED,
    adults           SMALLINT       NOT NULL CHECK (adults   >= 1),
    children         SMALLINT       NOT NULL DEFAULT 0 CHECK (children >= 0),
    infants          SMALLINT       NOT NULL DEFAULT 0 CHECK (infants  >= 0),
    pets             SMALLINT       NOT NULL DEFAULT 0 CHECK (pets     >= 0),
    nightly_price    NUMERIC(10,2)  NOT NULL,
    cleaning_fee     NUMERIC(10,2)  NOT NULL DEFAULT 0,
    total_price      NUMERIC(10,2)  NOT NULL,
    currency         CHAR(3)        NOT NULL,
    status           booking_status NOT NULL DEFAULT 'pending',
    hold_expires_at  TIMESTAMPTZ,
    idempotency_key  UUID           NOT NULL UNIQUE,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CHECK (check_out > check_in),
    UNIQUE (id, listing_id, guest_id),
    CONSTRAINT no_double_booking EXCLUDE USING gist (
        listing_id WITH =,
        stay       WITH &&
    ) WHERE (status IN ('pending', 'confirmed', 'completed'))
)
""",
    """
CREATE INDEX bookings_guest_idx ON bookings (guest_id)
""",
    """
CREATE INDEX bookings_pending_hold_idx ON bookings (hold_expires_at) WHERE status = 'pending'
""",
    """
CREATE TABLE reviews (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id            BIGINT   NOT NULL UNIQUE,
    listing_id            BIGINT   NOT NULL,
    guest_id              BIGINT   NOT NULL,
    rating                SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    cleanliness_rating    SMALLINT CHECK (cleanliness_rating   BETWEEN 1 AND 5),
    accuracy_rating       SMALLINT CHECK (accuracy_rating      BETWEEN 1 AND 5),
    check_in_rating       SMALLINT CHECK (check_in_rating      BETWEEN 1 AND 5),
    communication_rating  SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
    location_rating       SMALLINT CHECK (location_rating      BETWEEN 1 AND 5),
    value_rating          SMALLINT CHECK (value_rating         BETWEEN 1 AND 5),
    comment               TEXT     NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (booking_id, listing_id, guest_id)
        REFERENCES bookings (id, listing_id, guest_id)
)
""",
    """
CREATE INDEX reviews_listing_idx ON reviews (listing_id, created_at DESC)
""",
    """
CREATE FUNCTION reviews_require_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM bookings
                   WHERE id = NEW.booking_id AND status = 'completed') THEN
        RAISE EXCEPTION 'booking % is not completed, it cannot be reviewed', NEW.booking_id;
    END IF;
    RETURN NEW;
END $$
""",
    """
CREATE TRIGGER reviews_completed_check
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION reviews_require_completed()
""",
    """
CREATE FUNCTION refresh_listing_rating() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lid BIGINT := COALESCE(NEW.listing_id, OLD.listing_id);
BEGIN
    UPDATE listings l
    SET    avg_rating   = s.avg,
           review_count = s.cnt
    FROM  (SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt
           FROM reviews WHERE listing_id = lid) s
    WHERE  l.id = lid;
    RETURN NULL;
END $$
""",
    """
CREATE TRIGGER reviews_rating_sync
AFTER INSERT OR UPDATE OF rating OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_listing_rating()
""",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for table in (
        "reviews",
        "bookings",
        "listing_amenities",
        "amenities",
        "amenity_categories",
        "listing_photos",
        "listings",
        "cities",
        "countries",
        "auth_attempts",
        "refresh_tokens",
        "users",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("DROP FUNCTION IF EXISTS reviews_require_completed()")
    op.execute("DROP FUNCTION IF EXISTS refresh_listing_rating()")
    op.execute("DROP TYPE IF EXISTS booking_status")
    op.execute("DROP TYPE IF EXISTS property_type")
