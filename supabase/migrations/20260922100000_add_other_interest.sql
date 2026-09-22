-- The "autre" category already exists throughout the app (CATEGORY_ORDER /
-- CATEGORY_KEYS in interests-grid.tsx, group-interest-select.tsx,
-- suggest-interest-form.tsx, admin-interest-suggestions-client.tsx, and the
-- interest_suggestions_category_check constraint), but the interests
-- catalogue itself has no row in it yet, so the category never actually
-- appears for users. Seed a single catch-all "Autre" interest so it's
-- selectable from the start, same as every other category.
insert into public.interests (slug, label_fr, label_en, label_es, category, emoji)
values ('autre', 'Autre', 'Other', 'Otro', 'autre', '✨')
on conflict (slug) do nothing;
