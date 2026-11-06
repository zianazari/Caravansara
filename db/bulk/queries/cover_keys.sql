SELECT DISTINCT ON (listing_photos.listing_id) listing_photos.listing_id, listing_photos.storage_key
FROM listing_photos
WHERE listing_photos.listing_id IN (:ids::BIGINT) ORDER BY listing_photos.listing_id, listing_photos.sort_order
