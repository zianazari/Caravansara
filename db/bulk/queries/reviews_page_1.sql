SELECT reviews.id, reviews.booking_id, reviews.listing_id, reviews.guest_id, reviews.rating, reviews.cleanliness_rating, reviews.accuracy_rating, reviews.check_in_rating, reviews.communication_rating, reviews.location_rating, reviews.value_rating, reviews.comment, reviews.created_at
FROM reviews
WHERE reviews.listing_id = :listing_id::BIGINT ORDER BY reviews.created_at DESC, reviews.id DESC
 LIMIT :limit::INTEGER OFFSET :offset::INTEGER
