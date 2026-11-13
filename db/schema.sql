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
-- Updated 2026-11-07 for listing review by an admin (migration 0006, specs/backend (004)):
--   + users.kind, users.disabled_at; auth_attempts allows 'admin_login'
--   + listings.review_status, submitted_at, rejection_reason, review_version
--   + listing_review_events, admin_address_views (two new tables)
-- Updated 2026-11-13 through migration 0012: 17 application tables, shared holidays,
-- per-listing pricing_policy and saved booking nightly_prices; wishlists/outbox included.
-- Alembic migrations in backend/migrations are the source of truth; 0001 is
-- this file, and this file is kept in sync with later migrations.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- lets "listing_id WITH =" join a GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS postgis;      -- geography type, ST_DWithin, ST_Distance
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- trigram index for the admin's user search (feature 051)

-- ---------- Enums ----------------------------------------------------
CREATE TYPE property_type  AS ENUM ('entire_place', 'private_room', 'shared_room');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'expired', 'completed');
CREATE TYPE account_kind          AS ENUM ('member', 'admin');
CREATE TYPE listing_review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE review_action         AS ENUM ('submitted', 'edited', 'resubmitted', 'approved', 'rejected');

-- ---------- Users ----------------------------------------------------
-- One table for guests and hosts: a host is simply a user who owns listings.
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT        NOT NULL,
    password_hash  TEXT        NOT NULL,                -- argon2
    full_name      TEXT        NOT NULL,
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Admins live here too, so the email index below keeps one email to one account of either
    -- kind. Only the create-admin command writes 'admin'; no API input has this field. An admin
    -- token works on no member endpoint, so an admin cannot list or book.
    kind           account_kind NOT NULL DEFAULT 'member',
    -- Set by disable-admin: the admin can no longer log in or act, even with a live token.
    disabled_at    TIMESTAMPTZ
);
-- 'A@x.com' and 'a@x.com' must not become two accounts
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
-- the admin's user search: any part of an email or a name, LIKE '%…%' (feature 051, migration 0011)
CREATE INDEX users_search_trgm_idx ON users USING gin ((lower(email) || ' ' || lower(full_name)) gin_trgm_ops);

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
-- Admin logins count apart ('admin_login'), so neither kind of login can lock the other out.
CREATE TABLE auth_attempts (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action        TEXT        NOT NULL CHECK (action IN ('login', 'register', 'admin_login')),
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

    -- price + times. 14,2: rials; largest total = 1e9 x 365 + 1e9 (specs/backend (002))
    price_per_night  NUMERIC(14,2) NOT NULL CHECK (price_per_night > 0),
    cleaning_fee     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    currency         CHAR(3)       NOT NULL DEFAULT 'EUR',
    pricing_policy   JSONB         NOT NULL DEFAULT '{}'::jsonb, -- host rules; one rule per night
    check_in_time    TIME          NOT NULL DEFAULT '15:00',
    check_out_time   TIME          NOT NULL DEFAULT '11:00',

    -- rank (star rating), cached and kept fresh by a trigger on reviews
    avg_rating       NUMERIC(3,2)  CHECK (avg_rating BETWEEN 1 AND 5),   -- NULL until first review
    review_count     INT           NOT NULL DEFAULT 0,

    is_active        BOOLEAN       NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- review by an admin. Public = is_active AND review_status = 'approved' (no stored column).
    -- New rows are pending, so no listing skips the queue; 0006 approved every existing one.
    review_status    listing_review_status NOT NULL DEFAULT 'pending',
    submitted_at     TIMESTAMPTZ   DEFAULT now(),   -- entered the queue; the queue is oldest first
    rejection_reason TEXT,                          -- the last reason, only while rejected; the host reads it
    -- +1 on every descriptive edit (title, description, type, city, neighbourhood, address, point,
    -- amenities, a new photo, a caption or room tag). A decision names the version the admin saw
    -- and applies only if it is still current, so an edit made after is never approved unseen.
    review_version   INT           NOT NULL DEFAULT 0,

    CHECK (pets_allowed OR max_pets = 0),
    CONSTRAINT listings_pending_submitted_check CHECK (review_status <> 'pending' OR submitted_at IS NOT NULL),
    CONSTRAINT listings_rejection_reason_check
        CHECK ((review_status = 'rejected') = (rejection_reason IS NOT NULL)
               AND (rejection_reason IS NULL
                    OR (char_length(rejection_reason) <= 1000 AND btrim(rejection_reason) <> '')))
);
CREATE INDEX listings_city_idx   ON listings (city_id) WHERE is_active;
CREATE INDEX listings_host_idx   ON listings (host_id);
CREATE INDEX listings_public_location_idx ON listings USING gist (public_location) WHERE is_active;   -- radial search
-- The admin's queue, its size and its oldest wait (read by the worker for the dashboard).
CREATE INDEX listings_review_queue_idx ON listings (submitted_at, id) WHERE review_status = 'pending';

-- History of every submission and decision, with who did it (host or admin). Append-only: the
-- trigger at the end of the file refuses UPDATE and DELETE, so the record cannot be rewritten.
CREATE TABLE listing_review_events (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id     BIGINT        NOT NULL REFERENCES listings(id),
    action         review_action NOT NULL,   -- 'edited': an edit sent an approved listing back
    actor_id       BIGINT        NOT NULL REFERENCES users(id),
    review_version INT           NOT NULL,   -- the version submitted or decided on
    reason         TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT listing_review_events_reason_check CHECK ((action = 'rejected') = (reason IS NOT NULL))
);
CREATE INDEX listing_review_events_listing_idx ON listing_review_events (listing_id, created_at);

-- One row each time an admin opens a listing with its exact address, written in the same
-- transaction as the answer (constitution V: who, which listing, when). Nothing reads it yet.
CREATE TABLE admin_address_views (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id   BIGINT      NOT NULL REFERENCES users(id),
    listing_id BIGINT      NOT NULL REFERENCES listings(id),
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
-- Search never reads it (specs/backend (003)); it stays for the foreign key: deleting an amenity
-- checks its listings in 4 ms with it, 120 ms (a full scan) without.
CREATE INDEX listing_amenities_amenity_idx ON listing_amenities (amenity_id);

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
    nightly_prices   JSONB         NOT NULL DEFAULT '[]'::jsonb, -- immutable per-night booking snapshot
    currency         CHAR(3)        NOT NULL,

    status           booking_status NOT NULL DEFAULT 'pending',
    hold_expires_at  TIMESTAMPTZ,                   -- pending hold while the guest pays (~15 min)
    paid_at          TIMESTAMPTZ,                   -- when the guest paid; the receipt's time (047, migration 0010)
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
-- Measured on 100,000 listings and 3 million bookings (specs/backend/measurements.md (003)):
-- a host's "bookings of my listing", in page order (was a full scan)
CREATE INDEX bookings_listing_check_in_idx ON bookings (listing_id, check_in, id);
-- search with dates: every booking that blocks the dates, at once (no_double_booking needs a listing)
CREATE INDEX bookings_active_stay_idx ON bookings USING gist (stay)
    WHERE status IN ('pending', 'confirmed', 'completed');
-- the worker completes finished stays every minute: check_out is bounded by now + 14 hours
CREATE INDEX bookings_confirmed_check_out_idx ON bookings (check_out) WHERE status = 'confirmed';
-- the admin's bookings list: newest first, one status at a time (feature 051, migration 0011)
CREATE INDEX bookings_status_id_idx ON bookings (status, id);

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

-- The review history is a record: nobody rewrites or removes it.
CREATE FUNCTION listing_review_events_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'listing_review_events is append-only';
END $$;

CREATE TRIGGER listing_review_events_append_only
BEFORE UPDATE OR DELETE ON listing_review_events
FOR EACH ROW EXECUTE FUNCTION listing_review_events_refuse_change();

-- ---------- Shared country holiday calendar (0012) --------------------
CREATE TABLE holidays (
    country_code CHAR(2) NOT NULL REFERENCES countries(code),
    day          DATE NOT NULL,
    name         TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    PRIMARY KEY (country_code, day)
);

-- ---------- Saved listings (0007) ------------------------------------
CREATE TABLE wishlist_items (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX wishlist_items_user_saved_idx ON wishlist_items (user_id, saved_at DESC, listing_id);

-- ---------- Transactional email outbox (0008 / 0009) ------------------
CREATE TABLE email_outbox (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind            TEXT NOT NULL CHECK (kind IN ('listing_approved', 'listing_rejected', 'booking_confirmed_guest', 'booking_confirmed_host')),
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 300),
    body            TEXT NOT NULL CHECK (length(body) >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts        SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    sent_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    last_error      TEXT,
    CHECK (sent_at IS NULL OR failed_at IS NULL)
);
CREATE INDEX email_outbox_due_idx ON email_outbox (next_attempt_at) WHERE sent_at IS NULL AND failed_at IS NULL;
