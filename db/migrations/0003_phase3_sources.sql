-- Phase 3 sources. Names must match the keys in config/cities/chicago.yaml.
insert into sources (name, type, base_url, cadence) values
    ('chicago_public_library', 'api', 'https://gateway.bibliocommons.com/v2/libraries/chipublib/events', 'weekly'),
    ('choose_chicago',         'api', 'https://www.choosechicago.com/wp-json/tribe/events/v1/events', 'weekly')
on conflict (name) do nothing;
