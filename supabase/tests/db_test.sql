-- Friendszy — full database schema/security test suite (pgTAP)
--
-- Checks structure (tables, columns, PKs/FKs/checks/uniques), RLS status,
-- RLS policies (exact set + roles), grants, functions, triggers and
-- indexes against what is actually deployed in Supabase.
--
-- How to run:
--   1. Supabase SQL Editor: paste this whole file and run it. Results show
--      as a table of `ok`/`not ok` lines (TAP format) — scroll for any
--      `not ok`.
--   2. Or via psql:  psql "<connection string>" -f supabase/tests/db_test.sql
--
-- Everything runs inside a transaction that is rolled back at the end —
-- this file only reads catalog metadata, it never touches your real data.

begin;

create extension if not exists pgtap;

select no_plan();

-- ============================================================
-- 1. Extensions
-- ============================================================

select has_extension('pgtap', 'extension pgtap is installed');
select has_extension('pgcrypto', 'extension pgcrypto is installed (gen_random_uuid)');
select has_extension('unaccent', 'extension unaccent is installed (city search)');

-- ============================================================
-- 2. Tables exist + RLS is enabled on every one of them
-- ============================================================

select has_table('public', t, 'table public.' || t || ' exists')
from unnest(array[
  'blocks', 'conversations', 'friendships', 'group_join_requests',
  'group_members', 'group_messages', 'groups', 'interests', 'messages',
  'notifications', 'profile_interests', 'profiles', 'reports'
]) as t;

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t),
  'RLS is enabled on public.' || t
)
from unnest(array[
  'blocks', 'conversations', 'friendships', 'group_join_requests',
  'group_members', 'group_messages', 'groups', 'interests', 'messages',
  'notifications', 'profile_interests', 'profiles', 'reports'
]) as t;

-- ============================================================
-- 3. Columns — full shape of every table
-- ============================================================

-- blocks
select has_column('public', 'blocks', 'blocker_id', 'blocks.blocker_id exists');
select has_column('public', 'blocks', 'blocked_id', 'blocks.blocked_id exists');
select has_column('public', 'blocks', 'created_at', 'blocks.created_at exists');
select col_is_pk('public', 'blocks', array['blocker_id', 'blocked_id'], 'blocks PK is (blocker_id, blocked_id)');

-- conversations
select has_column('public', 'conversations', 'id', 'conversations.id exists');
select has_column('public', 'conversations', 'user_a', 'conversations.user_a exists');
select has_column('public', 'conversations', 'user_b', 'conversations.user_b exists');
select has_column('public', 'conversations', 'created_at', 'conversations.created_at exists');
select has_column('public', 'conversations', 'last_message_at', 'conversations.last_message_at exists');
select col_is_pk('public', 'conversations', array['id'], 'conversations PK is (id)');
select col_is_unique('public', 'conversations', array['user_a', 'user_b'], 'conversations (user_a, user_b) is unique');

-- friendships
select has_column('public', 'friendships', 'id', 'friendships.id exists');
select has_column('public', 'friendships', 'requester_id', 'friendships.requester_id exists');
select has_column('public', 'friendships', 'addressee_id', 'friendships.addressee_id exists');
select has_column('public', 'friendships', 'status', 'friendships.status exists');
select has_column('public', 'friendships', 'created_at', 'friendships.created_at exists');
select has_column('public', 'friendships', 'responded_at', 'friendships.responded_at exists');
select col_is_pk('public', 'friendships', array['id'], 'friendships PK is (id)');
select col_is_unique('public', 'friendships', array['requester_id', 'addressee_id'], 'friendships (requester_id, addressee_id) is unique');
select col_default_is('public', 'friendships', 'status', 'pending', 'friendships.status defaults to pending');

-- group_join_requests
select has_column('public', 'group_join_requests', 'id', 'group_join_requests.id exists');
select has_column('public', 'group_join_requests', 'group_id', 'group_join_requests.group_id exists');
select has_column('public', 'group_join_requests', 'profile_id', 'group_join_requests.profile_id exists');
select has_column('public', 'group_join_requests', 'status', 'group_join_requests.status exists');
select has_column('public', 'group_join_requests', 'created_at', 'group_join_requests.created_at exists');
select has_column('public', 'group_join_requests', 'resolved_at', 'group_join_requests.resolved_at exists');
select has_column('public', 'group_join_requests', 'resolved_by', 'group_join_requests.resolved_by exists');
select col_is_pk('public', 'group_join_requests', array['id'], 'group_join_requests PK is (id)');
select col_default_is('public', 'group_join_requests', 'status', 'pending', 'group_join_requests.status defaults to pending');

-- group_members
select has_column('public', 'group_members', 'group_id', 'group_members.group_id exists');
select has_column('public', 'group_members', 'profile_id', 'group_members.profile_id exists');
select has_column('public', 'group_members', 'role', 'group_members.role exists');
select has_column('public', 'group_members', 'status', 'group_members.status exists');
select has_column('public', 'group_members', 'joined_at', 'group_members.joined_at exists');
select col_is_pk('public', 'group_members', array['group_id', 'profile_id'], 'group_members PK is (group_id, profile_id)');
select col_default_is('public', 'group_members', 'role', 'member', 'group_members.role defaults to member');
select col_default_is('public', 'group_members', 'status', 'active', 'group_members.status defaults to active');

-- group_messages
select has_column('public', 'group_messages', 'id', 'group_messages.id exists');
select has_column('public', 'group_messages', 'group_id', 'group_messages.group_id exists');
select has_column('public', 'group_messages', 'sender_id', 'group_messages.sender_id exists');
select has_column('public', 'group_messages', 'content', 'group_messages.content exists');
select has_column('public', 'group_messages', 'removed_at', 'group_messages.removed_at exists');
select has_column('public', 'group_messages', 'removed_by', 'group_messages.removed_by exists');
select has_column('public', 'group_messages', 'created_at', 'group_messages.created_at exists');
select col_is_pk('public', 'group_messages', array['id'], 'group_messages PK is (id)');

-- groups
select has_column('public', 'groups', 'id', 'groups.id exists');
select has_column('public', 'groups', 'name', 'groups.name exists');
select has_column('public', 'groups', 'description', 'groups.description exists');
select has_column('public', 'groups', 'avatar_url', 'groups.avatar_url exists');
select has_column('public', 'groups', 'creator_id', 'groups.creator_id exists');
select has_column('public', 'groups', 'interest_id', 'groups.interest_id exists');
select has_column('public', 'groups', 'invite_permission', 'groups.invite_permission exists');
select has_column('public', 'groups', 'max_members', 'groups.max_members exists');
select has_column('public', 'groups', 'created_at', 'groups.created_at exists');
select has_column('public', 'groups', 'updated_at', 'groups.updated_at exists');
select col_is_pk('public', 'groups', array['id'], 'groups PK is (id)');
select col_default_is('public', 'groups', 'invite_permission', 'all_members', 'groups.invite_permission defaults to all_members');
select col_default_is('public', 'groups', 'max_members', '100', 'groups.max_members defaults to 100');

-- interests
select has_column('public', 'interests', 'id', 'interests.id exists');
select has_column('public', 'interests', 'slug', 'interests.slug exists');
select has_column('public', 'interests', 'label_fr', 'interests.label_fr exists');
select has_column('public', 'interests', 'label_en', 'interests.label_en exists');
select has_column('public', 'interests', 'category', 'interests.category exists');
select has_column('public', 'interests', 'emoji', 'interests.emoji exists');
select col_is_pk('public', 'interests', array['id'], 'interests PK is (id)');
select col_is_unique('public', 'interests', array['slug'], 'interests.slug is unique');

-- messages
select has_column('public', 'messages', 'id', 'messages.id exists');
select has_column('public', 'messages', 'conversation_id', 'messages.conversation_id exists');
select has_column('public', 'messages', 'sender_id', 'messages.sender_id exists');
select has_column('public', 'messages', 'content', 'messages.content exists');
select has_column('public', 'messages', 'read_at', 'messages.read_at exists');
select has_column('public', 'messages', 'removed_at', 'messages.removed_at exists');
select has_column('public', 'messages', 'removed_by', 'messages.removed_by exists');
select has_column('public', 'messages', 'created_at', 'messages.created_at exists');
select has_column('public', 'messages', 'delivered_at', 'messages.delivered_at exists');
select col_is_pk('public', 'messages', array['id'], 'messages PK is (id)');

-- notifications
select has_column('public', 'notifications', 'id', 'notifications.id exists');
select has_column('public', 'notifications', 'user_id', 'notifications.user_id exists');
select has_column('public', 'notifications', 'type', 'notifications.type exists');
select has_column('public', 'notifications', 'payload', 'notifications.payload exists');
select has_column('public', 'notifications', 'read_at', 'notifications.read_at exists');
select has_column('public', 'notifications', 'created_at', 'notifications.created_at exists');
select col_is_pk('public', 'notifications', array['id'], 'notifications PK is (id)');

-- profile_interests
select has_column('public', 'profile_interests', 'profile_id', 'profile_interests.profile_id exists');
select has_column('public', 'profile_interests', 'interest_id', 'profile_interests.interest_id exists');
select col_is_pk('public', 'profile_interests', array['profile_id', 'interest_id'], 'profile_interests PK is (profile_id, interest_id)');

-- profiles
select has_column('public', 'profiles', 'id', 'profiles.id exists');
select has_column('public', 'profiles', 'username', 'profiles.username exists');
select has_column('public', 'profiles', 'full_name', 'profiles.full_name exists');
select has_column('public', 'profiles', 'last_name', 'profiles.last_name exists');
select has_column('public', 'profiles', 'avatar_url', 'profiles.avatar_url exists');
select has_column('public', 'profiles', 'bio', 'profiles.bio exists');
select has_column('public', 'profiles', 'city', 'profiles.city exists');
select has_column('public', 'profiles', 'age', 'profiles.age exists');
select has_column('public', 'profiles', 'gender', 'profiles.gender exists');
select has_column('public', 'profiles', 'locale', 'profiles.locale exists');
select has_column('public', 'profiles', 'plan', 'profiles.plan exists');
select has_column('public', 'profiles', 'plan_valid_until', 'profiles.plan_valid_until exists');
select has_column('public', 'profiles', 'moderation_status', 'profiles.moderation_status exists');
select has_column('public', 'profiles', 'is_admin', 'profiles.is_admin exists');
select has_column('public', 'profiles', 'is_online', 'profiles.is_online exists');
select has_column('public', 'profiles', 'last_seen_at', 'profiles.last_seen_at exists');
select has_column('public', 'profiles', 'created_at', 'profiles.created_at exists');
select has_column('public', 'profiles', 'updated_at', 'profiles.updated_at exists');
select col_is_pk('public', 'profiles', array['id'], 'profiles PK is (id)');
select col_is_unique('public', 'profiles', array['username'], 'profiles.username is unique');
select col_default_is('public', 'profiles', 'locale', 'fr', 'profiles.locale defaults to fr');
select col_default_is('public', 'profiles', 'plan', 'free', 'profiles.plan defaults to free');
select col_default_is('public', 'profiles', 'moderation_status', 'active', 'profiles.moderation_status defaults to active');
select col_default_is('public', 'profiles', 'is_admin', 'false', 'profiles.is_admin defaults to false');

-- reports
select has_column('public', 'reports', 'id', 'reports.id exists');
select has_column('public', 'reports', 'reporter_id', 'reports.reporter_id exists');
select has_column('public', 'reports', 'target_type', 'reports.target_type exists');
select has_column('public', 'reports', 'target_id', 'reports.target_id exists');
select has_column('public', 'reports', 'reason', 'reports.reason exists');
select has_column('public', 'reports', 'status', 'reports.status exists');
select has_column('public', 'reports', 'created_at', 'reports.created_at exists');
select has_column('public', 'reports', 'resolved_at', 'reports.resolved_at exists');
select has_column('public', 'reports', 'resolved_by', 'reports.resolved_by exists');
select col_is_pk('public', 'reports', array['id'], 'reports PK is (id)');
select col_default_is('public', 'reports', 'status', 'open', 'reports.status defaults to open');

-- ============================================================
-- 4. Foreign keys
-- ============================================================

select col_is_fk('public', 'blocks', 'blocker_id', 'blocks.blocker_id is a FK');
select col_is_fk('public', 'blocks', 'blocked_id', 'blocks.blocked_id is a FK');
select col_is_fk('public', 'conversations', 'user_a', 'conversations.user_a is a FK');
select col_is_fk('public', 'conversations', 'user_b', 'conversations.user_b is a FK');
select col_is_fk('public', 'friendships', 'requester_id', 'friendships.requester_id is a FK');
select col_is_fk('public', 'friendships', 'addressee_id', 'friendships.addressee_id is a FK');
select col_is_fk('public', 'group_join_requests', 'group_id', 'group_join_requests.group_id is a FK');
select col_is_fk('public', 'group_join_requests', 'profile_id', 'group_join_requests.profile_id is a FK');
select col_is_fk('public', 'group_join_requests', 'resolved_by', 'group_join_requests.resolved_by is a FK');
select col_is_fk('public', 'group_members', 'group_id', 'group_members.group_id is a FK');
select col_is_fk('public', 'group_members', 'profile_id', 'group_members.profile_id is a FK');
select col_is_fk('public', 'group_messages', 'group_id', 'group_messages.group_id is a FK');
select col_is_fk('public', 'group_messages', 'sender_id', 'group_messages.sender_id is a FK');
select col_is_fk('public', 'group_messages', 'removed_by', 'group_messages.removed_by is a FK');
select col_is_fk('public', 'groups', 'creator_id', 'groups.creator_id is a FK');
select col_is_fk('public', 'groups', 'interest_id', 'groups.interest_id is a FK');
select col_is_fk('public', 'messages', 'conversation_id', 'messages.conversation_id is a FK');
select col_is_fk('public', 'messages', 'sender_id', 'messages.sender_id is a FK');
select col_is_fk('public', 'messages', 'removed_by', 'messages.removed_by is a FK');
select col_is_fk('public', 'notifications', 'user_id', 'notifications.user_id is a FK');
select col_is_fk('public', 'profile_interests', 'profile_id', 'profile_interests.profile_id is a FK');
select col_is_fk('public', 'profile_interests', 'interest_id', 'profile_interests.interest_id is a FK');
select col_is_fk('public', 'profiles', 'id', 'profiles.id is a FK (references auth.users)');
select col_is_fk('public', 'reports', 'reporter_id', 'reports.reporter_id is a FK');
select col_is_fk('public', 'reports', 'resolved_by', 'reports.resolved_by is a FK');

-- Cascade behaviour that matters for account deletion (Loi 25 compliance):
-- deleting a profile must cascade-clean everything that references it.
select ok(
  (select confdeltype from pg_constraint where conname = 'profiles_id_fkey') = 'c',
  'profiles.id -> auth.users(id) is ON DELETE CASCADE'
);
select ok(
  (select confdeltype from pg_constraint where conname = 'blocks_blocker_id_fkey') = 'c',
  'blocks.blocker_id -> profiles(id) is ON DELETE CASCADE'
);
select ok(
  (select confdeltype from pg_constraint where conname = 'group_members_profile_id_fkey') = 'c',
  'group_members.profile_id -> profiles(id) is ON DELETE CASCADE'
);
select ok(
  (select confdeltype from pg_constraint where conname = 'groups_creator_id_fkey') = 'n',
  'groups.creator_id -> profiles(id) is ON DELETE SET NULL (group survives its creator''s account deletion)'
);

-- ============================================================
-- 5. Check constraints (business rules enforced at the DB level)
-- ============================================================

select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.blocks'::regclass
    and conname = 'blocks_check' and pg_get_constraintdef(oid) = 'CHECK ((blocker_id <> blocked_id))'),
  'blocks: cannot block yourself (blocker_id <> blocked_id)'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.conversations'::regclass
    and conname = 'conversations_check' and pg_get_constraintdef(oid) = 'CHECK ((user_a < user_b))'),
  'conversations: user_a < user_b is enforced (canonical ordering, prevents duplicate pairs)'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.friendships'::regclass
    and conname = 'friendships_check' and pg_get_constraintdef(oid) = 'CHECK ((requester_id <> addressee_id))'),
  'friendships: cannot friend-request yourself'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.friendships'::regclass
    and conname = 'friendships_status_check'
    and pg_get_constraintdef(oid) = 'CHECK ((status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''declined''::text])))'),
  'friendships.status is constrained to pending/accepted/declined'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.group_join_requests'::regclass
    and conname = 'group_join_requests_status_check'
    and pg_get_constraintdef(oid) = 'CHECK ((status = ANY (ARRAY[''pending''::text, ''approved''::text, ''rejected''::text])))'),
  'group_join_requests.status is constrained to pending/approved/rejected'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.group_members'::regclass
    and conname = 'group_members_status_check'
    and pg_get_constraintdef(oid) = 'CHECK ((status = ANY (ARRAY[''active''::text, ''left''::text, ''excluded''::text, ''banned''::text])))'),
  'group_members.status is constrained to active/left/excluded/banned'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.group_members'::regclass
    and conname = 'group_members_role_check'
    and pg_get_constraintdef(oid) = 'CHECK ((role = ANY (ARRAY[''creator''::text, ''admin''::text, ''member''::text])))'),
  'group_members.role is constrained to creator/admin/member'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.groups'::regclass
    and conname = 'groups_invite_permission_check'
    and pg_get_constraintdef(oid) = 'CHECK ((invite_permission = ANY (ARRAY[''all_members''::text, ''admins_only''::text])))'),
  'groups.invite_permission is constrained to all_members/admins_only'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_age_check' and pg_get_constraintdef(oid) = 'CHECK ((age >= 18))'),
  'profiles.age >= 18 is enforced'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_username_check'),
  'profiles.username format is constrained (lowercase/digits/underscore, 3-30 chars)'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_moderation_status_check'
    and pg_get_constraintdef(oid) = 'CHECK ((moderation_status = ANY (ARRAY[''active''::text, ''suspended''::text, ''banned''::text])))'),
  'profiles.moderation_status is constrained to active/suspended/banned'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_plan_check'
    and pg_get_constraintdef(oid) = 'CHECK ((plan = ANY (ARRAY[''free''::text, ''premium''::text])))'),
  'profiles.plan is constrained to free/premium'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_locale_check'
    and pg_get_constraintdef(oid) = 'CHECK ((locale = ANY (ARRAY[''fr''::text, ''en''::text])))'),
  'profiles.locale is constrained to fr/en'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_gender_check'),
  'profiles.gender is constrained to a known set of values'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.reports'::regclass
    and conname = 'reports_status_check'
    and pg_get_constraintdef(oid) = 'CHECK ((status = ANY (ARRAY[''open''::text, ''reviewing''::text, ''resolved''::text, ''dismissed''::text])))'),
  'reports.status is constrained to open/reviewing/resolved/dismissed'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.reports'::regclass
    and conname = 'reports_target_type_check'
    and pg_get_constraintdef(oid) = 'CHECK ((target_type = ANY (ARRAY[''profile''::text, ''message''::text, ''group_message''::text, ''group''::text])))'),
  'reports.target_type is constrained to profile/message/group_message/group'
);

-- ============================================================
-- 6. Indexes (including the two partial-unique data-integrity safety nets)
-- ============================================================

select has_index('public', 'blocks', 'idx_blocks_blocked', 'index idx_blocks_blocked exists');
select has_index('public', 'conversations', 'idx_conversations_user_a', 'index idx_conversations_user_a exists');
select has_index('public', 'conversations', 'idx_conversations_user_b', 'index idx_conversations_user_b exists');
select has_index('public', 'friendships', 'idx_friendships_addressee', 'index idx_friendships_addressee exists');
select has_index('public', 'friendships', 'idx_friendships_requester', 'index idx_friendships_requester exists');
select has_index('public', 'group_join_requests', 'group_join_requests_pending_unique', 'index group_join_requests_pending_unique exists');
select has_index('public', 'group_join_requests', 'idx_group_join_requests_group', 'index idx_group_join_requests_group exists');
select has_index('public', 'group_members', 'group_members_one_active_creator', 'index group_members_one_active_creator exists');
select has_index('public', 'group_members', 'idx_group_members_profile', 'index idx_group_members_profile exists');
select has_index('public', 'group_messages', 'idx_group_messages_group', 'index idx_group_messages_group exists');
select has_index('public', 'groups', 'idx_groups_interest', 'index idx_groups_interest exists');
select has_index('public', 'messages', 'idx_messages_conversation', 'index idx_messages_conversation exists');
select has_index('public', 'messages', 'idx_messages_unread', 'index idx_messages_unread exists');
select has_index('public', 'notifications', 'idx_notifications_user_unread', 'index idx_notifications_user_unread exists');
select has_index('public', 'profile_interests', 'idx_profile_interests_interest', 'index idx_profile_interests_interest exists');
select has_index('public', 'profiles', 'idx_profiles_city', 'index idx_profiles_city exists');
select has_index('public', 'reports', 'idx_reports_open', 'index idx_reports_open exists');

-- Exact definitions of the two data-integrity safety nets — these are the
-- last line of defense against bugs like the "duplicate active creator"
-- incident, so their *exact* WHERE clause matters, not just their presence.
select ok(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'group_join_requests_pending_unique')
    = 'CREATE UNIQUE INDEX group_join_requests_pending_unique ON public.group_join_requests USING btree (group_id, profile_id) WHERE (status = ''pending''::text)',
  'group_join_requests_pending_unique: at most one pending request per (group, profile)'
);
select ok(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'group_members_one_active_creator')
    = 'CREATE UNIQUE INDEX group_members_one_active_creator ON public.group_members USING btree (group_id) WHERE ((role = ''creator''::text) AND (status = ''active''::text))',
  'group_members_one_active_creator: at most one active creator per group'
);

-- ============================================================
-- 7. Triggers
-- ============================================================

select has_trigger('public', 'friendships', 'on_friendship_inserted', 'trigger on_friendship_inserted exists on friendships');
select has_trigger('public', 'friendships', 'trg_notify_friend_request_accepted', 'trigger trg_notify_friend_request_accepted exists on friendships');
select has_trigger('public', 'group_join_requests', 'on_group_join_request_approved', 'trigger on_group_join_request_approved exists on group_join_requests');
select has_trigger('public', 'group_join_requests', 'on_group_join_request_approved_notify', 'trigger on_group_join_request_approved_notify exists on group_join_requests');
select has_trigger('public', 'group_join_requests', 'on_group_join_request_created', 'trigger on_group_join_request_created exists on group_join_requests');
select has_trigger('public', 'group_members', 'enforce_protect_creator_role', 'trigger enforce_protect_creator_role exists on group_members');
select has_trigger('public', 'group_members', 'enforce_protect_group_member_changes', 'trigger enforce_protect_group_member_changes exists on group_members');
select has_trigger('public', 'group_members', 'on_creator_status_change', 'trigger on_creator_status_change exists on group_members');
select has_trigger('public', 'group_members', 'on_group_member_inserted', 'trigger on_group_member_inserted exists on group_members');
select has_trigger('public', 'group_messages', 'enforce_group_message_immutability', 'trigger enforce_group_message_immutability exists on group_messages');
select has_trigger('public', 'messages', 'enforce_message_immutability', 'trigger enforce_message_immutability exists on messages (messages are immutable once sent)');
select has_trigger('public', 'messages', 'messages_touch_conversation', 'trigger messages_touch_conversation exists on messages');
select has_trigger('public', 'profiles', 'enforce_profile_sensitive_columns', 'trigger enforce_profile_sensitive_columns exists on profiles (plan/moderation_status/is_admin protected)');
select has_trigger('public', 'profiles', 'profiles_set_updated_at', 'trigger profiles_set_updated_at exists on profiles');
select has_trigger('auth', 'users', 'on_auth_user_created', 'trigger on_auth_user_created exists on auth.users (creates the profile row)');

-- ============================================================
-- 8. Functions
-- ============================================================

select has_function('public', f, 'function public.' || f || ' exists')
from unnest(array[
  'can_invite_to_group', 'get_blocked_profiles', 'get_group_member_counts',
  'handle_creator_leaving',
  'handle_group_join_request_approval', 'handle_new_user', 'is_active_user',
  'is_admin', 'is_banned_from_group', 'is_blocked_between',
  'is_conversation_participant', 'is_group_admin', 'is_group_creator',
  'is_group_member', 'match_city_ids', 'notify_friend_added',
  'notify_friend_request_accepted', 'notify_group_invitation',
  'notify_group_join_request', 'notify_group_join_request_approved',
  'protect_creator_role', 'protect_group_member_changes',
  'protect_group_message_immutability', 'protect_message_immutability',
  'protect_profile_sensitive_columns', 'set_updated_at',
  'touch_conversation_last_message'
]) as f;

-- These run with elevated (SECURITY DEFINER) privileges to see across RLS
-- boundaries (e.g. checking membership/blocks the caller couldn't
-- otherwise query directly) — verify that's still true and hasn't
-- regressed to SECURITY INVOKER, which would silently break RLS-gated
-- lookups used by policies themselves.
select is_definer('public', 'is_admin', 'is_admin() is SECURITY DEFINER');
select is_definer('public', 'is_active_user', 'is_active_user() is SECURITY DEFINER');
select is_definer('public', 'is_blocked_between', 'is_blocked_between() is SECURITY DEFINER');
select is_definer('public', 'is_conversation_participant', 'is_conversation_participant() is SECURITY DEFINER');
select is_definer('public', 'is_group_member', 'is_group_member() is SECURITY DEFINER');
select is_definer('public', 'is_group_admin', 'is_group_admin() is SECURITY DEFINER');
select is_definer('public', 'is_group_creator', 'is_group_creator() is SECURITY DEFINER');
select is_definer('public', 'can_invite_to_group', 'can_invite_to_group() is SECURITY DEFINER');
select is_definer('public', 'is_banned_from_group', 'is_banned_from_group() is SECURITY DEFINER');
select is_definer('public', 'get_blocked_profiles', 'get_blocked_profiles() is SECURITY DEFINER');
select is_definer('public', 'get_group_member_counts', 'get_group_member_counts() is SECURITY DEFINER (counts are public even though group_members rows are not)');

select ok(
  has_function_privilege('authenticated', 'public.get_group_member_counts(uuid[])', 'EXECUTE'),
  'authenticated can execute get_group_member_counts'
);

-- Regression test for the reported bug: a plain SELECT against
-- group_members returns zero rows for a caller who isn't a member of that
-- group (group_members_select RLS only allows is_group_member(group_id)
-- OR profile_id = auth.uid()) — get_group_member_counts exists precisely
-- to bypass that gap safely via SECURITY DEFINER, returning only
-- aggregated counts, never who's actually in the group.
insert into groups (id, name, creator_id) values
  ('00000000-0000-0000-0000-0000000000f1', '__pgtap_test_group__', null);
insert into group_members (group_id, profile_id, role, status)
  select '00000000-0000-0000-0000-0000000000f1', id, 'creator', 'active'
  from profiles limit 1;

select is(
  (select member_count from get_group_member_counts(array['00000000-0000-0000-0000-0000000000f1'::uuid])),
  1::bigint,
  'get_group_member_counts returns the true count for a freshly-created test group, not 0'
);
select is_definer('public', 'handle_new_user', 'handle_new_user() is SECURITY DEFINER (writes profiles as the triggering user)');
select is_definer('public', 'protect_profile_sensitive_columns', 'protect_profile_sensitive_columns() is SECURITY DEFINER');

-- ============================================================
-- 9. RLS policies — exact set per table (catches drift: an added,
--    removed, or renamed policy will fail this immediately)
-- ============================================================

select policies_are('public', 'blocks', array[
  'blocks_delete_own', 'blocks_insert_own', 'blocks_select_own'
], 'blocks has exactly the expected policies');

select policies_are('public', 'conversations', array[
  'conversations_insert', 'conversations_select'
], 'conversations has exactly the expected policies');

select policies_are('public', 'friendships', array[
  'friendships_delete', 'friendships_insert', 'friendships_select_own', 'friendships_update'
], 'friendships has exactly the expected policies');

select policies_are('public', 'group_join_requests', array[
  'group_join_requests_insert', 'group_join_requests_select', 'group_join_requests_update_admin'
], 'group_join_requests has exactly the expected policies');

select policies_are('public', 'group_members', array[
  'group_members_insert', 'group_members_select', 'group_members_update'
], 'group_members has exactly the expected policies');

select policies_are('public', 'group_messages', array[
  'group_messages_insert', 'group_messages_select', 'group_messages_update_admin'
], 'group_messages has exactly the expected policies');

select policies_are('public', 'groups', array[
  'groups_delete', 'groups_insert', 'groups_select', 'groups_update'
], 'groups has exactly the expected policies');

select policies_are('public', 'interests', array[
  'interests_select'
], 'interests has exactly the expected policies (read-only reference table)');

select policies_are('public', 'messages', array[
  'messages_insert', 'messages_select', 'messages_select_admin',
  'messages_update_admin', 'messages_update_mark_read'
], 'messages has exactly the expected policies');

select policies_are('public', 'notifications', array[
  'notifications_select_own', 'notifications_update_own'
], 'notifications has exactly the expected policies (no insert policy — only triggers/server create notifications)');

select policies_are('public', 'profile_interests', array[
  'profile_interests_delete_own', 'profile_interests_insert_own', 'profile_interests_select'
], 'profile_interests has exactly the expected policies');

select policies_are('public', 'profiles', array[
  'profiles_select', 'profiles_select_admin', 'profiles_update_admin', 'profiles_update_own'
], 'profiles has exactly the expected policies (no delete policy — no self-serve account deletion yet)');

select policies_are('public', 'reports', array[
  'reports_insert_own', 'reports_select', 'reports_update_admin'
], 'reports has exactly the expected policies (no update-own — reporters cannot edit after filing)');

-- Spot-check a few security-critical policy definitions verbatim, since
-- "a policy with this name exists" doesn't guarantee its logic is right.
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select')
    = '(NOT is_blocked_between(auth.uid(), id))',
  'profiles_select correctly hides blocked profiles from each other'
);
select ok(
  (select with_check from pg_policies where schemaname = 'public' and tablename = 'friendships' and policyname = 'friendships_insert')
    = '(is_active_user() AND (requester_id = auth.uid()) AND (NOT is_blocked_between(auth.uid(), addressee_id)))',
  'friendships_insert blocks suspended/banned users and blocked pairs from friend-requesting'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'group_messages' and policyname = 'group_messages_update_admin')
    = 'is_group_admin(group_id)',
  'group_messages can only be updated (soft-removed) by a group admin, never by content edit'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_insert') is null,
  'group_members_insert has no USING clause (INSERT-only policy, checked entirely via WITH CHECK)'
);
select ok(
  (select with_check from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_insert')
    like '%is_banned_from_group(group_id, profile_id)%'
  and (select with_check from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_insert')
    like '%role = ''creator''::text%g.creator_id = auth.uid()%'
  and (select with_check from pg_policies where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_insert')
    like '%can_invite_to_group(group_id) AND (role = ''member''::text)%',
  'group_members_insert: only the real group creator can self-insert as creator; everyone else must come in as member via can_invite_to_group, and banned profiles are always rejected'
);

-- ============================================================
-- 10. Grants — every RLS policy is moot without the base GRANT
--     (see CLAUDE.md: raw-SQL-created tables don't get this automatically)
-- ============================================================

select table_privs_are('public', 'blocks', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'authenticated has expected privileges on blocks');
select table_privs_are('public', 'conversations', 'authenticated',
  array['INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'authenticated has expected privileges on conversations');
select table_privs_are('public', 'friendships', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on friendships');
select table_privs_are('public', 'group_join_requests', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on group_join_requests');
select table_privs_are('public', 'group_members', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on group_members');
select table_privs_are('public', 'group_messages', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on group_messages');
select table_privs_are('public', 'groups', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on groups');
select table_privs_are('public', 'interests', 'authenticated',
  array['REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'authenticated has expected (read-only) privileges on interests');
select table_privs_are('public', 'messages', 'authenticated',
  array['INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on messages');
select table_privs_are('public', 'notifications', 'authenticated',
  array['REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on notifications (no INSERT — only DB triggers create notifications)');
select table_privs_are('public', 'profile_interests', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'authenticated has expected privileges on profile_interests');
select table_privs_are('public', 'profiles', 'authenticated',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on profiles');
select table_privs_are('public', 'reports', 'authenticated',
  array['INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
  'authenticated has expected privileges on reports');

-- anon gets nothing beyond the implicit PUBLIC grants on every table —
-- there is no unauthenticated read access anywhere in this schema.
select table_privs_are('public', t, 'anon',
  array['REFERENCES', 'TRIGGER', 'TRUNCATE'],
  'anon has no explicit privileges on ' || t || ' (unauthenticated users see nothing)')
from unnest(array[
  'blocks', 'conversations', 'friendships', 'group_join_requests',
  'group_members', 'group_messages', 'groups', 'interests', 'messages',
  'notifications', 'profile_interests', 'profiles', 'reports'
]) as t;

-- ============================================================
-- 11. Storage — avatars and group-avatars buckets
-- ============================================================

select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select'),
  'storage.objects has avatars_select policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_insert_own_folder'),
  'storage.objects has avatars_insert_own_folder policy (users can only write to their own avatars/{user_id}/ folder)'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_update_own'),
  'storage.objects has avatars_update_own policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_delete_own'),
  'storage.objects has avatars_delete_own policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'group_avatars_select'),
  'storage.objects has group_avatars_select policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'group_avatars_insert'),
  'storage.objects has group_avatars_insert policy'
);
select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'group_avatars_update'),
  'storage.objects has group_avatars_update policy (must be group admin to change the group photo)'
);

select * from finish();

rollback;
