SELECT count(*) AS count_1
FROM bookings
WHERE bookings.guest_id = :guest_id::BIGINT
