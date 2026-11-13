SELECT l.id FROM listings l
WHERE l.review_status = 'pending'
ORDER BY lower(l.title) ASC, l.id ASC
LIMIT :limit OFFSET :offset
