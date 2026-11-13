SELECT b.id
FROM bookings b JOIN listings l ON l.id = b.listing_id
ORDER BY lower(l.title) ASC, b.id ASC
LIMIT :limit OFFSET :offset
