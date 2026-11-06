UPDATE bookings b
SET    status = 'completed'
FROM   listings l
JOIN   cities c ON c.id = l.city_id
WHERE  b.listing_id = l.id
  AND  b.status = 'confirmed'
  -- No time zone is more than 14 hours ahead of UTC, so a stay whose check-out has passed in its
  -- city checks out on this date at the latest. The bound lets an index skip every later stay
  -- (specs/003-index-review research R5); the exact test is the next line.
  AND  b.check_out <= ((CAST(:now AS timestamptz) AT TIME ZONE 'UTC') + interval '14 hours')::date
  -- check-out day and time are local to the city
  AND  (b.check_out + l.check_out_time) AT TIME ZONE c.timezone <= :now
RETURNING b.id
