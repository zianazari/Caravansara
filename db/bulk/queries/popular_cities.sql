SELECT l.city_id, count(*)
FROM   bookings b JOIN listings l ON l.id = b.listing_id
WHERE  b.status IN ('confirmed', 'completed') AND b.created_at >= :since::TIMESTAMP WITH TIME ZONE
  AND  l.is_active AND l.review_status = 'approved'
GROUP  BY l.city_id
