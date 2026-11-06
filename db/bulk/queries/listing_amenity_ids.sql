SELECT listing_amenities.amenity_id
FROM listing_amenities
WHERE listing_amenities.listing_id = :listing_id::BIGINT
