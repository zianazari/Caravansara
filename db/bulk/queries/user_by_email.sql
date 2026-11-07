SELECT users.id, users.email, users.password_hash, users.full_name, users.avatar_url, users.created_at, users.kind, users.disabled_at
FROM users
WHERE lower(users.email) = :email::VARCHAR
