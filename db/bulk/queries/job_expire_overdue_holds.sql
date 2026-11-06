UPDATE bookings SET status = 'expired', hold_expires_at = NULL
WHERE status = 'pending' AND hold_expires_at <= :now
RETURNING id
