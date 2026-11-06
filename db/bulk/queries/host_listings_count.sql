SELECT count(*) AS count_1
FROM listings
WHERE listings.host_id = :host_id::BIGINT
