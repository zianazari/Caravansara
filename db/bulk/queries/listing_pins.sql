SELECT listings.id, ST_Y(CAST(listings.public_location AS geometry(GEOMETRY,-1))) AS "ST_Y_1", ST_X(CAST(listings.public_location AS geometry(GEOMETRY,-1))) AS "ST_X_1"
FROM listings
WHERE listings.id IN (:ids::BIGINT)
