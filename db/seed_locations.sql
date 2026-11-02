-- Countries and cities for "Where" (catalog seed; the demo data in seed_demo.sql uses these four cities).
-- timezone is the IANA name: "today" and stay end are computed in city time.
INSERT INTO countries (code, name) VALUES
 ('NL', 'Netherlands'), ('PT', 'Portugal'), ('DK', 'Denmark'), ('SE', 'Sweden');

INSERT INTO cities (country_id, name, timezone)
SELECT co.id, c.name, c.tz
FROM (VALUES
 ('NL', 'Amsterdam',  'Europe/Amsterdam'),
 ('PT', 'Lisbon',     'Europe/Lisbon'),
 ('DK', 'Copenhagen', 'Europe/Copenhagen'),
 ('SE', 'Stockholm',  'Europe/Stockholm')
) AS c(code, name, tz)
JOIN countries co ON co.code = c.code;
