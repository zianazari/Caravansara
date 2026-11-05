-- =====================================================================
-- Caravansara (Airbnb-like place reservation site) — PostgreSQL 16 + PostGIS schema
-- Scope: simple. Rank = star rating. Comments = review text only.
-- Updated 2026-11-02 to match Caravansara/docs/backend-design.md:
--   + refresh_tokens, auth_attempts          (two new tables)
--   + users: unique on lower(email)
--   + listing_photos: (listing_id, sort_order) unique is DEFERRABLE
--   + cities.timezone
--   + bookings: partial index on hold_expires_at for pending holds
--   + listings.public_location (PostGIS geography) for radial search
-- Alembic migrations in backend/migrations are the source of truth; 0001 is
-- this file, and this file is kept in sync with later migrations.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- lets "listing_id WITH =" join a GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS postgis;      -- geography type, ST_DWithin, ST_Distance

-- ---------- Enums ----------------------------------------------------
CREATE TYPE property_type  AS ENUM ('entire_place', 'private_room', 'shared_room');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'expired', 'completed');

-- ---------- Users ----------------------------------------------------
-- One table for guests and hosts: a host is simply a user who owns listings.
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT        NOT NULL,
    password_hash  TEXT        NOT NULL,                -- argon2
    full_name      TEXT        NOT NULL,
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 'A@x.com' and 'a@x.com' must not become two accounts
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- Refresh tokens: only a hash is stored; rotation revokes the old row.
CREATE TABLE refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,            -- e.g. SHA-256 hex of the token
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,                            -- set on logout or rotation
    CHECK (expires_at > created_at)
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- Rate limit for login and registration: one row per attempt, counted per time window.
CREATE TABLE auth_attempts (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action        TEXT        NOT NULL CHECK (action IN ('login', 'register')),
    identifier    TEXT        NOT NULL,                 -- lower(email) or client IP
    succeeded     BOOLEAN     NOT NULL,
    attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_attempts_lookup_idx ON auth_attempts (action, identifier, attempted_at DESC);

-- ---------- Location ("Where") ---------------------------------------
CREATE TABLE countries (
    id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  CHAR(2) NOT NULL UNIQUE,              -- ISO 3166-1, e.g. 'FI'
    name  TEXT    NOT NULL UNIQUE
);

CREATE TABLE cities (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_id  SMALLINT NOT NULL REFERENCES countries(id),
    name        TEXT     NOT NULL,
    timezone    TEXT     NOT NULL,      -- IANA name, e.g. 'Europe/Helsinki': "today" and stay end use city time
    UNIQUE (country_id, name)
);

-- ---------- Listings (the place) -------------------------------------
CREATE TABLE listings (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    host_id          BIGINT        NOT NULL REFERENCES users(id),
    title            TEXT          NOT NULL,
    description      TEXT,
    property_type    property_type NOT NULL,

    -- where + map
    city_id          INT           NOT NULL REFERENCES cities(id),
    neighborhood     TEXT,                                   -- e.g. 'Pasila'
    address          TEXT          NOT NULL,                 -- shown only to the host and confirmed/completed guests
    latitude         NUMERIC(9,6)  NOT NULL CHECK (latitude  BETWEEN -90  AND 90),    -- real point: private
    longitude        NUMERIC(9,6)  NOT NULL CHECK (longitude BETWEEN -180 AND 180),   -- real point: private
    -- Public point: the real point moved ~100–500 m at random by the app, stored once
    -- and recomputed only when the real point changes. Search, distance and the map pin
    -- use only this, so shrinking the radius or averaging can't reveal the address.
    public_location  geography(Point, 4326) NOT NULL,

    -- who (capacity)
    max_guests       SMALLINT      NOT NULL CHECK (max_guests >= 1),   -- adults + children
    pets_allowed     BOOLEAN       NOT NULL DEFAULT false,
    max_pets         SMALLINT      NOT NULL DEFAULT 0 CHECK (max_pets >= 0),

    -- size
    bedrooms         SMALLINT      NOT NULL DEFAULT 0 CHECK (bedrooms  >= 0),
    beds             SMALLINT      NOT NULL DEFAULT 1 CHECK (beds      >= 0),
    bathrooms        NUMERIC(3,1)  NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),

    -- price + times. 14,2: rials; largest total = 1e9 x 365 + 1e9 (specs/002-rial-price-columns)
    price_per_night  NUMERIC(14,2) NOT NULL CHECK (price_per_night > 0),
    cleaning_fee     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    currency         CHAR(3)       NOT NULL DEFAULT 'EUR',
    check_in_time    TIME          NOT NULL DEFAULT '15:00',
    check_out_time   TIME          NOT NULL DEFAULT '11:00',

    -- rank (star rating), cached and kept fresh by a trigger on reviews
    avg_rating       NUMERIC(3,2)  CHECK (avg_rating BETWEEN 1 AND 5),   -- NULL until first review
    review_count     INT           NOT NULL DEFAULT 0,

    is_active        BOOLEAN       NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CHECK (pets_allowed OR max_pets = 0)
);
CREATE INDEX listings_city_idx   ON listings (city_id) WHERE is_active;
CREATE INDEX listings_host_idx   ON listings (host_id);
CREATE INDEX listings_public_location_idx ON listings USING gist (public_location) WHERE is_active;   -- radial search

-- ---------- Photos ---------------------------------------------------
CREATE TABLE listing_photos (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id  BIGINT   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    storage_key TEXT     NOT NULL UNIQUE,   -- object-storage key, e.g. 'listings/42/7f3a.jpg'
                                            -- the app builds the CDN URL from it
    width       INT      NOT NULL CHECK (width  > 0),   -- px of the original; lets the page
    height      INT      NOT NULL CHECK (height > 0),   -- reserve space before it loads
    caption     TEXT,
    room_tag    TEXT,                       -- 'Kitchen', 'Bedroom 1' … (photo tour)
    sort_order  SMALLINT NOT NULL,          -- 0 = cover photo
    -- checked at COMMIT, so reordering photos or swapping the cover in one transaction works
    CONSTRAINT listing_photos_order_key UNIQUE (listing_id, sort_order) DEFERRABLE INITIALLY DEFERRED
);

-- ---------- Amenities (features) -------------------------------------
CREATE TABLE amenity_categories (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT     NOT NULL UNIQUE,   -- 'Kitchen and dining'
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE amenities (
    id           SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id  SMALLINT NOT NULL REFERENCES amenity_categories(id),
    name         TEXT     NOT NULL UNIQUE,  -- 'Wifi', 'Microwave'
    icon         TEXT                       -- icon key for the UI
);

CREATE TABLE listing_amenities (
    listing_id  BIGINT   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    amenity_id  SMALLINT NOT NULL REFERENCES amenities(id),
    PRIMARY KEY (listing_id, amenity_id)
);
CREATE INDEX listing_amenities_amenity_idx ON listing_amenities (amenity_id);  -- "has Wifi" filter

-- ---------- Bookings (no double booking) -----------------------------
CREATE TABLE bookings (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id       BIGINT         NOT NULL REFERENCES listings(id),
    guest_id         BIGINT         NOT NULL REFERENCES users(id),

    -- when: half-open [check_in, check_out) so a new guest can arrive the day the last one leaves
    check_in         DATE           NOT NULL,
    check_out        DATE           NOT NULL,
    stay             DATERANGE      GENERATED ALWAYS AS (daterange(check_in, check_out, '[)')) STORED,

    -- who
    adults           SMALLINT       NOT NULL CHECK (adults   >= 1),
    children         SMALLINT       NOT NULL DEFAULT 0 CHECK (children >= 0),
    infants          SMALLINT       NOT NULL DEFAULT 0 CHECK (infants  >= 0),
    pets             SMALLINT       NOT NULL DEFAULT 0 CHECK (pets     >= 0),

    -- price snapshot at booking time (listing price may change later). 14,2 as in listings
    nightly_price    NUMERIC(14,2)  NOT NULL,
    cleaning_fee     NUMERIC(14,2)  NOT NULL DEFAULT 0,
    total_price      NUMERIC(14,2)  NOT NULL,
    currency         CHAR(3)        NOT NULL,

    status           booking_status NOT NULL DEFAULT 'pending',
    hold_expires_at  TIMESTAMPTZ,                   -- pending hold while the guest pays (~15 min)
    idempotency_key  UUID           NOT NULL UNIQUE, -- a retried "Reserve" click can't book twice
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CHECK (check_out > check_in),
    UNIQUE (id, listing_id, guest_id),               -- target for the reviews composite FK

    -- THE guarantee: two active bookings of the same listing can never overlap.
    -- Concurrent inserts are serialised by the index; the loser gets error 23P01.
    CONSTRAINT no_double_booking EXCLUDE USING gist (
        listing_id WITH =,
        stay       WITH &&
    ) WHERE (status IN ('pending', 'confirmed', 'completed'))
);
CREATE INDEX bookings_guest_idx ON bookings (guest_id);
-- the worker expires overdue holds every minute without scanning all bookings
CREATE INDEX bookings_pending_hold_idx ON bookings (hold_expires_at) WHERE status = 'pending';

-- ---------- Reviews (rank + comment) ---------------------------------
-- One review per booking, written by that booking's guest about that booking's listing.
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
    -- guarantees listing_id and guest_id really belong to that booking
    FOREIGN KEY (booking_id, listing_id, guest_id)
        REFERENCES bookings (id, listing_id, guest_id)
);
CREATE INDEX reviews_listing_idx ON reviews (listing_id, created_at DESC);

-- Only a completed stay can be reviewed.
CREATE FUNCTION reviews_require_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM bookings
                   WHERE id = NEW.booking_id AND status = 'completed') THEN
        RAISE EXCEPTION 'booking % is not completed, it cannot be reviewed', NEW.booking_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER reviews_completed_check
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION reviews_require_completed();

-- Keep listings.avg_rating / review_count in sync (the "4.76 (279)" on the card).
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
END $$;

CREATE TRIGGER reviews_rating_sync
AFTER INSERT OR UPDATE OF rating OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_listing_rating();
