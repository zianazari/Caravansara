SELECT count(*) FROM (SELECT NULL::geography AS center) p JOIN listings l ON true WHERE l.is_active AND l.max_guests >= :guests AND l.city_id = :city_id AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND b.status IN ('pending', 'confirmed', 'completed')
                   AND  (b.status <> 'pending' OR b.hold_expires_at > now())
                   AND  b.stay && daterange(CAST(:check_in AS date), CAST(:check_out AS date), '[)'))
