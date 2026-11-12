SELECT count(*) AS count_1
FROM users
WHERE (lower(users.email) || ' ' || lower(users.full_name)) LIKE :pattern::VARCHAR
