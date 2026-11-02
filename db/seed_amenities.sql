-- Amenity catalog modelled on Airbnb's categories (representative items, extend freely).
INSERT INTO amenity_categories (name, sort_order) VALUES
 ('Bathroom', 1), ('Bedroom and laundry', 2), ('Entertainment', 3), ('Family', 4),
 ('Heating and cooling', 5), ('Home safety', 6), ('Internet and office', 7),
 ('Kitchen and dining', 8), ('Location features', 9), ('Outdoor', 10),
 ('Parking and facilities', 11), ('Services', 12);

INSERT INTO amenities (category_id, name, icon)
SELECT c.id, a.name, a.icon
FROM (VALUES
 ('Bathroom',                'Hair dryer',          'hair-dryer'),
 ('Bathroom',                'Shampoo',             'bottle'),
 ('Bathroom',                'Hot water',           'droplet'),
 ('Bedroom and laundry',     'Washer',              'washer'),
 ('Bedroom and laundry',     'Dryer',               'dryer'),
 ('Bedroom and laundry',     'Bed linens',          'bed'),
 ('Bedroom and laundry',     'Iron',                'iron'),
 ('Entertainment',           'TV',                  'tv'),
 ('Family',                  'Crib',                'baby-bed'),
 ('Family',                  'High chair',          'chair'),
 ('Heating and cooling',     'Heating',             'flame'),
 ('Heating and cooling',     'Air conditioning',    'snowflake'),
 ('Home safety',             'Smoke alarm',         'alarm'),
 ('Home safety',             'Carbon monoxide alarm','alarm'),
 ('Home safety',             'Fire extinguisher',   'fire-extinguisher'),
 ('Home safety',             'First aid kit',       'first-aid'),
 ('Internet and office',     'Wifi',                'wifi'),
 ('Internet and office',     'Dedicated workspace', 'desk'),
 ('Kitchen and dining',      'Kitchen',             'kitchen'),
 ('Kitchen and dining',      'Refrigerator',        'fridge'),
 ('Kitchen and dining',      'Microwave',           'microwave'),
 ('Kitchen and dining',      'Dishwasher',          'dishwasher'),
 ('Kitchen and dining',      'Coffee maker',        'coffee'),
 ('Kitchen and dining',      'Cooking basics',      'pan'),
 ('Location features',       'Lake access',         'water'),
 ('Outdoor',                 'Balcony',             'balcony'),
 ('Outdoor',                 'Sauna',               'sauna'),
 ('Parking and facilities',  'Free parking',        'parking'),
 ('Parking and facilities',  'Elevator',            'elevator'),
 ('Parking and facilities',  'Hot tub',             'hot-tub'),
 ('Services',                'Self check-in',       'key')
 -- "Pets allowed" is not an amenity: it lives in listings.pets_allowed / max_pets
) AS a(category, name, icon)
JOIN amenity_categories c ON c.name = a.category;
