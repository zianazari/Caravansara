SELECT EXISTS (SELECT 1 FROM bookings b
                      WHERE b.listing_id = :listing_id AND b.guest_id = :guest_id
                        AND b.status IN ('pending', 'confirmed', 'completed')
                        AND (b.status <> 'pending' OR b.hold_expires_at > now()))
