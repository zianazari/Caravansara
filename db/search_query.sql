-- Search: Where + When + Who + map bounds + amenity filters
-- Change the values in "params"; in the app they become bind parameters.
-- Amenities use AND logic, like Airbnb's filter chips: ticking Wifi + Kitchen
-- returns only listings that have BOTH. An empty array means "no amenity filter".
WITH params AS (
    SELECT 'Helsinki'::text       AS city,
           'FI'::char(2)          AS country,
           DATE '2026-11-03'      AS check_in,
           DATE '2026-11-04'      AS check_out,
           2                      AS adults,
           0                      AS children,
           0                      AS pets,
           60.17::numeric AS min_lat, 60.22::numeric AS max_lat,   -- visible map rectangle
           24.90::numeric AS min_lng, 24.98::numeric AS max_lng,
           ARRAY['Wifi', 'Kitchen']::text[] AS must_have           -- '{}' = no filter
)
SELECT l.id, l.title, l.property_type, l.latitude, l.longitude,
       l.avg_rating, l.review_count,
       (p.check_out - p.check_in) * l.price_per_night + l.cleaning_fee AS total_price,
       (SELECT ph.storage_key FROM listing_photos ph
        WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1)      AS cover_key  -- app turns it into a CDN URL
FROM   params p
JOIN   cities    c  ON c.name = p.city
JOIN   countries co ON co.id = c.country_id AND co.code = p.country
JOIN   listings  l  ON l.city_id = c.id
WHERE  l.is_active
  -- map
  AND  l.latitude  BETWEEN p.min_lat AND p.max_lat
  AND  l.longitude BETWEEN p.min_lng AND p.max_lng
  -- who (infants don't count toward max_guests)
  AND  l.max_guests >= p.adults + p.children
  AND  (p.pets = 0 OR (l.pets_allowed AND l.max_pets >= p.pets))
  -- when: no active booking overlaps the requested stay
  AND  NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE  b.listing_id = l.id
           AND  b.status IN ('pending', 'confirmed', 'completed')
           AND  b.stay && daterange(p.check_in, p.check_out, '[)'))
  -- amenities: the listing must have ALL of them
  -- (count how many of the wanted amenities it has; it must equal how many were asked for)
  AND  cardinality(p.must_have) = (
         SELECT count(*)
         FROM   listing_amenities la
         JOIN   amenities a ON a.id = la.amenity_id
         WHERE  la.listing_id = l.id
           AND  a.name = ANY (p.must_have))
ORDER  BY l.avg_rating DESC NULLS LAST, l.review_count DESC;


-- Filter panel counts: "Wifi (2)", "Kitchen (1)" … for active listings in a city
SELECT a.name, count(*) AS listings
FROM   listing_amenities la
JOIN   amenities a ON a.id = la.amenity_id
JOIN   listings  l ON l.id = la.listing_id AND l.is_active
JOIN   cities    c ON c.id = l.city_id AND c.name = 'Helsinki'
GROUP  BY a.name
ORDER  BY listings DESC, a.name;
