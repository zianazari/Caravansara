-- Search: Where (city OR centre + radius) + When + Who + amenity filters
-- Change the values in "params"; in the app they become bind parameters.
-- Where: send EITHER city/country OR lat + lng + radius_km (1–100 km, checked by the service).
-- Privacy: only listings.public_location is used for filtering, distance and the pin.
-- Public:  only active listings an admin approved (specs/backend (004), FR-002).
--          The real latitude/longitude never leave the database here.
-- Amenities use AND logic, like Airbnb's filter chips. An empty array = no filter.
WITH params AS (
    SELECT NULL::text             AS city,          -- e.g. 'Helsinki'  (city mode)
           NULL::char(2)          AS country,       -- e.g. 'FI'
           60.1699::float8        AS lat,           -- radial mode: centre …
           24.9384::float8        AS lng,
           5::float8              AS radius_km,     -- … and radius
           DATE '2026-11-03'      AS check_in,
           DATE '2026-11-04'      AS check_out,
           2                      AS adults,
           0                      AS children,
           0                      AS pets,
           ARRAY['Wifi', 'Kitchen']::text[] AS must_have,
           'rating'::text         AS sort           -- 'rating' (default) or 'distance'
),
p AS (
    SELECT params.*,
           CASE WHEN lat IS NOT NULL
                THEN ST_MakePoint(lng, lat)::geography     -- ST_MakePoint takes (lng, lat): longitude first
           END AS center
    FROM params
)
SELECT l.id, l.title, l.property_type,
       ST_Y(l.public_location::geometry) AS pin_lat,                   -- public point only
       ST_X(l.public_location::geometry) AS pin_lng,
       ROUND((ST_Distance(l.public_location, p.center) / 1000)::numeric, 1) AS distance_km,
       l.avg_rating, l.review_count,
       (p.check_out - p.check_in) * l.price_per_night + l.cleaning_fee AS total_price,
       (SELECT ph.storage_key FROM listing_photos ph
        WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1)      AS cover_key  -- app turns it into a CDN URL
FROM   p
JOIN   listings  l  ON l.is_active AND l.review_status = 'approved'
JOIN   cities    c  ON c.id = l.city_id
JOIN   countries co ON co.id = c.country_id
WHERE  -- where: city mode or radial mode
       ( (p.city IS NOT NULL AND c.name = p.city AND co.code = p.country)
      OR (p.center IS NOT NULL AND ST_DWithin(l.public_location, p.center, p.radius_km * 1000)) )
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
ORDER  BY CASE WHEN p.sort = 'distance' THEN ST_Distance(l.public_location, p.center) END,
          l.avg_rating DESC NULLS LAST, l.review_count DESC
LIMIT 20 OFFSET 0;


-- Filter panel counts: "Wifi (2)", "Kitchen (1)" … for active listings in a city
SELECT a.name, count(*) AS listings
FROM   listing_amenities la
JOIN   amenities a ON a.id = la.amenity_id
JOIN   listings  l ON l.id = la.listing_id AND l.is_active AND l.review_status = 'approved'
JOIN   cities    c ON c.id = l.city_id AND c.name = 'Helsinki'
GROUP  BY a.name
ORDER  BY listings DESC, a.name;
