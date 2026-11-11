-- Representative parameters, picked from the data itself, so the same catalog works on any bulk
-- database (and, with whatever rows exist, on the test database). One row; each column is used by
-- catalog.json as "@column". The busiest rows are the worst case each page has to handle.
WITH city AS (
    SELECT c.name, c.id, avg(l.latitude)::float8 AS lat, avg(l.longitude)::float8 AS lng
    FROM   cities c LEFT JOIN listings l ON l.city_id = c.id
    WHERE  c.name IN ('London', 'Stockholm')
    GROUP  BY c.name, c.id
),
busy_listing AS (       -- the active listing with the most bookings: its host's "bookings of my listing"
    SELECT b.listing_id AS id, l.host_id
    FROM   bookings b JOIN listings l ON l.id = b.listing_id
    WHERE  l.is_active
    GROUP  BY b.listing_id, l.host_id
    ORDER  BY count(*) DESC, b.listing_id
    LIMIT  1
),
busy_guest AS (         -- the guest with the most bookings: "my trips"
    SELECT guest_id AS id FROM bookings GROUP BY guest_id ORDER BY count(*) DESC, guest_id LIMIT 1
)
SELECT (SELECT id  FROM city WHERE name = 'London')    AS london_id,
       (SELECT lat FROM city WHERE name = 'London')    AS london_lat,
       (SELECT lng FROM city WHERE name = 'London')    AS london_lng,
       (SELECT id  FROM city WHERE name = 'Stockholm') AS stockholm_id,
       (SELECT lat FROM city WHERE name = 'Stockholm') AS stockholm_lat,
       (SELECT lng FROM city WHERE name = 'Stockholm') AS stockholm_lng,
       (SELECT id FROM busy_listing)                   AS busy_listing,
       (SELECT host_id FROM busy_listing)              AS busy_listing_host,
       (SELECT listing_id FROM reviews GROUP BY listing_id ORDER BY count(*) DESC, listing_id LIMIT 1) AS reviewed_listing,
       (SELECT host_id FROM listings GROUP BY host_id ORDER BY count(*) DESC, host_id LIMIT 1)        AS big_host,
       (SELECT id FROM busy_guest)                     AS busy_guest,
       (SELECT lower(email) FROM users WHERE id = (SELECT id FROM busy_guest)) AS busy_guest_email,
       (SELECT listing_id FROM bookings WHERE guest_id = (SELECT id FROM busy_guest) ORDER BY id LIMIT 1) AS busy_guest_listing,
       (SELECT idempotency_key FROM bookings ORDER BY id DESC LIMIT 1)        AS any_idempotency_key,
       CURRENT_DATE + 35                               AS check_in,      -- three nights, five weeks ahead
       CURRENT_DATE + 38                               AS check_out,
       CURRENT_DATE + 49                               AS check_out_two_weeks, -- past the 7 nights the radius search collects for
       now()                                           AS now,
       now() - interval '1 hour'                       AS hour_ago,
       now() - interval '90 days'                      AS ninety_days_ago
