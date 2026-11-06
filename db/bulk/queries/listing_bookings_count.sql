SELECT count(*) AS count_1
FROM bookings
WHERE bookings.listing_id = :listing_id::BIGINT
