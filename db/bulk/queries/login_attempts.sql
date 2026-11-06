SELECT count(*) AS count_1
FROM auth_attempts
WHERE auth_attempts.action = :action::VARCHAR AND auth_attempts.identifier = :identifier::VARCHAR AND auth_attempts.attempted_at >= :since::TIMESTAMP WITH TIME ZONE AND auth_attempts.succeeded IS false
