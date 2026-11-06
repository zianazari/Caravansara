SELECT count(*) AS count_1
FROM reviews
WHERE reviews.listing_id = :listing_id::BIGINT
