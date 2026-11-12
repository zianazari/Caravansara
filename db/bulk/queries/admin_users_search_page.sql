SELECT users.id, users.email, users.password_hash, users.full_name, users.avatar_url, users.created_at, users.kind, users.disabled_at
FROM users
WHERE (lower(users.email) || ' ' || lower(users.full_name)) LIKE :pattern::VARCHAR ORDER BY users.id DESC
 LIMIT :limit::INTEGER OFFSET :offset::INTEGER
