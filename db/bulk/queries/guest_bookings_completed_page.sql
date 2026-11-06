SELECT bookings.id, bookings.listing_id, bookings.guest_id, bookings.check_in, bookings.check_out, bookings.adults, bookings.children, bookings.infants, bookings.pets, bookings.nightly_price, bookings.cleaning_fee, bookings.total_price, bookings.currency, bookings.status, bookings.hold_expires_at, bookings.idempotency_key, bookings.created_at
FROM bookings
WHERE bookings.guest_id = :guest_id::BIGINT AND bookings.status = :status::booking_status ORDER BY bookings.check_in DESC, bookings.id DESC
 LIMIT :limit::INTEGER OFFSET :offset::INTEGER
