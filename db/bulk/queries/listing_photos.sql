SELECT listing_photos.id, listing_photos.listing_id, listing_photos.storage_key, listing_photos.width, listing_photos.height, listing_photos.caption, listing_photos.room_tag, listing_photos.sort_order
FROM listing_photos
WHERE listing_photos.listing_id = :listing_id::BIGINT ORDER BY listing_photos.sort_order
