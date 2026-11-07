SELECT users.id, users.email, users.password_hash, users.full_name, users.avatar_url, users.created_at, users.kind, users.disabled_at
FROM users
WHERE users.id IN (:id1::BIGINT, :id2::BIGINT, :id3::BIGINT, :id4::BIGINT, :id5::BIGINT, :id6::BIGINT, :id7::BIGINT, :id8::BIGINT, :id9::BIGINT, :id10::BIGINT, :id11::BIGINT, :id12::BIGINT, :id13::BIGINT, :id14::BIGINT, :id15::BIGINT, :id16::BIGINT, :id17::BIGINT, :id18::BIGINT, :id19::BIGINT, :id20::BIGINT)
