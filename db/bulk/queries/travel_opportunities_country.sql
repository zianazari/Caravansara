-- GET /search/opportunities: all candidates in a country/currency, full flexible window.
SELECT l.id, l.title, l.property_type::text AS property_type,
               c.name AS city, c.timezone, co.code AS country_code,
               ST_Y(l.public_location::geometry) AS pin_lat,
               ST_X(l.public_location::geometry) AS pin_lng,
               l.avg_rating, l.review_count, l.max_guests,
               l.price_per_night, l.cleaning_fee, l.currency, l.pricing_policy,
               (SELECT ph.storage_key FROM listing_photos ph
                WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1) AS cover_key,
               COALESCE((SELECT jsonb_agg(jsonb_build_object('start', lower(b.stay), 'end', upper(b.stay)))
                   FROM bookings b WHERE b.listing_id = l.id
                   AND b.status IN ('pending', 'confirmed', 'completed')
                   AND (b.status <> 'pending' OR b.hold_expires_at > now())
                   AND b.stay && daterange(CAST(:start AS date), CAST(:end AS date), '[)')), '[]') AS blocked
        FROM listings l JOIN cities c ON c.id = l.city_id JOIN countries co ON co.id = c.country_id
        WHERE l.is_active AND l.review_status = 'approved'
          AND co.code = :country AND l.currency = :currency
          AND (CAST(:city_id AS bigint) IS NULL OR l.city_id = :city_id)
          AND l.max_guests >= :guests AND l.cleaning_fee < :budget
          AND (:pets = 0 OR (l.pets_allowed AND l.max_pets >= :pets))
        ORDER BY l.id;
