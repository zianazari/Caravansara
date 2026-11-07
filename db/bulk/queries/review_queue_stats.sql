SELECT count(*) AS count_1, min(listings.submitted_at) AS min_1
FROM listings
WHERE listings.review_status = 'pending'
