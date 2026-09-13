-- Adds Spanish (es) as a third supported language alongside fr/en (see
-- CLAUDE.md — this changes the project's stated bilingual scope; the
-- decision to migrate the DB rather than leave interest labels falling
-- back to fr/en was made explicitly with the client-side developer).
--
-- ============================================================================
-- READ BEFORE APPLYING — one part of this migration is a best-effort
-- reconstruction, not a verified change:
--
-- handle_interest_suggestion_resolution() is a SECURITY DEFINER trigger
-- function that has only ever existed live in Supabase (never checked into
-- a migration file here — see the comment in
-- 20260831120000_interests_admin_write.sql). Direct read access to the
-- production DB to pull its real definition was blocked in the environment
-- this migration was written in, so the CREATE OR REPLACE below is
-- reconstructed from what supabase/tests/db_test.sql documents about its
-- observable behaviour (slug generation, collision suffixing, notification
-- payloads) plus the label_es plumbing this migration adds. It is NOT a
-- diff against the real source.
--
-- Before running this migration against production:
--   1. In the Supabase Studio SQL editor, run:
--        select pg_get_functiondef('public.handle_interest_suggestion_resolution'::regproc);
--   2. Diff that output against the CREATE OR REPLACE FUNCTION below.
--   3. Pay special attention to trigger timing (BEFORE vs AFTER UPDATE) —
--      this reconstruction assumes BEFORE UPDATE (so setting NEW.created_interest_id
--      persists to the row within the admin's single UPDATE, per the pgTAP
--      comment "creates the interests row, writes back created_interest_id
--      ... all inside the single UPDATE the admin client issues"). If the
--      live trigger is actually AFTER UPDATE, this reconstruction is wrong
--      and needs rewriting as a guarded self-UPDATE instead.
--   4. Re-run supabase/tests/db_test.sql (the approve/reject functional
--      tests around "handle_interest_suggestion_resolution") after applying,
--      to catch any behavioural drift from the real function.
--
-- The rest of this migration (new columns, widened locale check,
-- get_public_map_points) is NOT a reconstruction — those are either brand
-- new additive columns or a function already tracked verbatim in
-- 20260818100000_public_map_points.sql, safe to extend directly.
-- ============================================================================

-- interests.label_es: nullable, not backfilled. The catalogue predates
-- Spanish and its existing rows have no Spanish translation yet (that's a
-- content task, not a schema one) — every read site in the app already
-- falls back to label_fr when label_es is null (see
-- src/lib/interests/label.ts). New/edited interests going forward should
-- populate it (the admin catalogue form now requires it).
alter table public.interests add column if not exists label_es text;

-- interest_suggestions.resolved_label_es: nullable like resolved_label_fr/en
-- (only ever set once a suggestion is approved).
alter table public.interest_suggestions add column if not exists resolved_label_es text;

-- Widen the locale check to accept the suggester's own submission language.
-- Constraint name confirmed against supabase/tests/db_test.sql (line ~521:
-- "interest_suggestions.locale is constrained to fr/en").
alter table public.interest_suggestions drop constraint if exists interest_suggestions_locale_check;
alter table public.interest_suggestions
  add constraint interest_suggestions_locale_check check (locale in ('fr', 'en', 'es'));

-- get_public_map_points(): known-good source, safe to extend directly (see
-- 20260818100000_public_map_points.sql — this is the same function,
-- category_label_es added to both branches of the union).
-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE shape changes
-- (adding category_label_es) — "cannot change return type of existing
-- function" (42P13) — so the old signature has to be dropped first. This
-- also drops its grants, reissued right after the CREATE below.
drop function if exists public.get_public_map_points();

create function public.get_public_map_points()
returns table (
  kind text,
  id uuid,
  title text,
  city text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  category_emoji text,
  category_label_fr text,
  category_label_en text,
  category_label_es text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'event'::text as kind,
    e.id,
    e.title,
    e.city,
    e.latitude,
    e.longitude,
    (
      select ep.url from public.event_photos ep
      where ep.event_id = e.id
      order by ep.position
      limit 1
    ) as photo_url,
    i.emoji as category_emoji,
    i.label_fr as category_label_fr,
    i.label_en as category_label_en,
    i.label_es as category_label_es
  from public.events e
  join public.interests i on i.id = e.interest_id
  where e.ends_at >= now()
    and e.latitude is not null
    and e.longitude is not null

  union all

  select
    'partner'::text as kind,
    pl.id,
    pl.name as title,
    pl.city,
    pl.latitude,
    pl.longitude,
    pl.photo_urls[1] as photo_url,
    i.emoji as category_emoji,
    i.label_fr as category_label_fr,
    i.label_en as category_label_en,
    i.label_es as category_label_es
  from public.partner_listings pl
  join public.interests i on i.id = pl.interest_id
  where pl.status = 'active'
    and pl.latitude is not null
    and pl.longitude is not null;
$$;

comment on function public.get_public_map_points() is
  'Public landing page (visiteur non connecté) map data. Strictly limited columns — no description, no registration counts, no partner contact info. SECURITY DEFINER so it needs no anon RLS policy on events/partner_listings themselves.';

grant execute on function public.get_public_map_points() to anon, authenticated;

-- handle_interest_suggestion_resolution(): RECONSTRUCTED, see warning block
-- at the top of this file. BEFORE UPDATE ON interest_suggestions, fires on
-- a status transition away from 'pending'.
create or replace function public.handle_interest_suggestion_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
  v_interest_id int;
  v_notify_label text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_base_slug := trim(both '_' from regexp_replace(
      lower(unaccent(coalesce(nullif(new.resolved_label_fr, ''), new.label))),
      '[^a-z0-9]+', '_', 'g'
    ));
    v_slug := v_base_slug;
    while exists (select 1 from public.interests where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '_' || v_suffix;
    end loop;

    insert into public.interests (slug, label_fr, label_en, label_es, category)
    values (v_slug, new.resolved_label_fr, new.resolved_label_en, nullif(new.resolved_label_es, ''), new.category)
    returning id into v_interest_id;

    new.created_interest_id := v_interest_id;

    v_notify_label := case new.locale
      when 'en' then new.resolved_label_en
      when 'es' then coalesce(nullif(new.resolved_label_es, ''), new.resolved_label_fr)
      else new.resolved_label_fr
    end;

    insert into public.notifications (user_id, type, payload)
    values (
      new.suggested_by,
      'interest_suggestion_approved',
      jsonb_build_object('interest_id', v_interest_id, 'label', v_notify_label)
    );

  elsif new.status = 'rejected' then
    insert into public.notifications (user_id, type, payload)
    values (
      new.suggested_by,
      'interest_suggestion_rejected',
      jsonb_build_object('label', new.label)
    );
  end if;

  return new;
end;
$$;

comment on function public.handle_interest_suggestion_resolution() is
  'BEFORE UPDATE ON interest_suggestions. RECONSTRUCTED on 2026-09-10 to add label_es plumbing for the Spanish rollout — see the warning block at the top of 20260910120000_add_spanish_locale.sql before trusting this in production. On a pending->approved transition: generates a slug from resolved_label_fr (lower/unaccented/non-alphanumeric->underscore, numeric-suffixed on collision), inserts the interests row, writes created_interest_id back onto the same suggestion row, and notifies the suggester with the interest id and their own submission locale''s resolved label. On pending->rejected: notifies the suggester with the originally-proposed label, no interests row created.';
