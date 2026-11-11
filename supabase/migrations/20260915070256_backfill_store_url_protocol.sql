-- Stores saved before the http(s):// requirement was added on website /
-- google_maps_url can have values like "www.mitienda.com" with no scheme.
-- safeHref() (src/lib/utils.ts) uses `new URL()`, which throws on schemeless
-- strings, so those links silently stopped rendering on the public store
-- page. Prepend https:// to any non-empty value that doesn't already start
-- with http:// or https://.
update stores
set website = 'https://' || website
where website is not null
  and website <> ''
  and website !~* '^https?://';

update stores
set google_maps_url = 'https://' || google_maps_url
where google_maps_url is not null
  and google_maps_url <> ''
  and google_maps_url !~* '^https?://';
