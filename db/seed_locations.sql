-- Countries and cities for "Where" (catalog seed). The demo data in seed_demo.sql uses all nine.
-- timezone is the IANA name: "today" and stay end are computed in city time.
-- Safe to run again: ON CONFLICT DO NOTHING adds only missing rows and never changes existing ones.
INSERT INTO countries (code, name) VALUES
 ('NL', 'Netherlands'), ('PT', 'Portugal'), ('DK', 'Denmark'), ('SE', 'Sweden'),
 ('GB', 'United Kingdom'), ('US', 'United States'), ('IR', 'Iran')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cities (country_id, name, timezone)
SELECT co.id, c.name, c.tz
FROM (VALUES
 ('NL', 'Amsterdam',     'Europe/Amsterdam'),
 ('PT', 'Lisbon',        'Europe/Lisbon'),
 ('DK', 'Copenhagen',    'Europe/Copenhagen'),
 ('SE', 'Stockholm',     'Europe/Stockholm'),
 ('GB', 'London',        'Europe/London'),
 ('US', 'New York City', 'America/New_York'),
 ('IR', 'Tehran',        'Asia/Tehran'),
 ('IR', 'Isfahan',       'Asia/Tehran'),
 ('IR', 'Shiraz',        'Asia/Tehran')
) AS c(code, name, tz)
JOIN countries co ON co.code = c.code
ON CONFLICT (country_id, name) DO NOTHING;
