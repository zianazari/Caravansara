SELECT bookings.status, count(*) AS count_1
FROM bookings GROUP BY bookings.status
