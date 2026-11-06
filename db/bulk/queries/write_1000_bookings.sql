INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price, cleaning_fee,
                      total_price, currency, status, idempotency_key)
SELECT l.id, :guest_id, CAST(:check_in AS date) + 400, CAST(:check_in AS date) + 403, 1, l.price_per_night,
       l.cleaning_fee, 3 * l.price_per_night + l.cleaning_fee, l.currency, 'confirmed', gen_random_uuid()
FROM   listings l WHERE l.is_active ORDER BY l.id LIMIT 1000
