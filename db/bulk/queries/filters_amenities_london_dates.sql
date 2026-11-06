WITH matching AS (SELECT l.id FROM (SELECT NULL::geography AS center) p JOIN listings l ON true WHERE l.is_active AND l.max_guests >= :guests AND l.city_id = :city_id AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND b.status IN ('pending', 'confirmed', 'completed')
           AND  (b.status <> 'pending' OR b.hold_expires_at > now())
           AND  b.stay && daterange(CAST(:check_in AS date), CAST(:check_out AS date), '[)'))),
counts AS (
    SELECT la.amenity_id, count(*) AS listings
    FROM   matching m
    JOIN   listing_amenities la ON la.listing_id = m.id
    GROUP  BY la.amenity_id
)
SELECT a.id, a.name, ac.name AS category, n.listings
FROM   counts n
JOIN   amenities a ON a.id = n.amenity_id
JOIN   amenity_categories ac ON ac.id = a.category_id
ORDER  BY n.listings DESC, a.name
