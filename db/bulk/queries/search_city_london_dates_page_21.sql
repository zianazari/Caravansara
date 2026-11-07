WITH matching AS MATERIALIZED (
    SELECT l.id, l.avg_rating, l.review_count, NULL::float8 AS distance_m
    FROM   (SELECT NULL::geography AS center) p
    JOIN   listings l ON true
    WHERE  l.is_active AND l.review_status = 'approved' AND l.max_guests >= :guests AND l.city_id = :city_id AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND b.status IN ('pending', 'confirmed', 'completed')
           AND  (b.status <> 'pending' OR b.hold_expires_at > now())
           AND  b.stay && daterange(CAST(:check_in AS date), CAST(:check_out AS date), '[)'))
),
page AS (SELECT m.* FROM matching m ORDER BY m.avg_rating DESC NULLS LAST, m.review_count DESC, m.id LIMIT :limit OFFSET :offset)
SELECT l.id, l.title, l.property_type::text AS property_type,
       c.name AS city, co.code AS country_code,
       ST_Y(l.public_location::geometry) AS pin_lat,
       ST_X(l.public_location::geometry) AS pin_lng,
       ROUND((ST_Distance(l.public_location, p.center) / 1000)::numeric, 1) AS distance_km,
       l.avg_rating, l.review_count, l.max_guests,
       l.price_per_night, l.cleaning_fee, l.currency,
       (CAST(:check_out AS date) - CAST(:check_in AS date)) * l.price_per_night + l.cleaning_fee AS total_price,
       (SELECT ph.storage_key FROM listing_photos ph
        WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1) AS cover_key,
       (SELECT count(*) FROM matching) AS total
FROM   page pg
JOIN   (SELECT NULL::geography AS center) p ON true
JOIN   listings  l  ON l.id = pg.id
JOIN   cities    c  ON c.id = l.city_id
JOIN   countries co ON co.id = c.country_id
ORDER  BY pg.avg_rating DESC NULLS LAST, pg.review_count DESC, pg.id
