-- Annuaire des participants de l'Afterwork INTERASSO.
-- Appliquée sur le projet Supabase « communitia » (eu-west-3, Paris).
-- Les tables vivent dans un schéma privé, non exposé par l'API : le public et
-- l'organisateur n'y accèdent qu'au travers des fonctions public.annuaire_*,
-- qui vérifient chacune ce qu'elles autorisent.

create schema if not exists annuaire;
revoke all on schema annuaire from public, anon, authenticated;

create table annuaire.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date not null,
  controller text not null,
  contact_email text,
  is_open boolean not null default false,
  admin_key_hash text,
  created_at timestamptz not null default now(),
  constraint events_contact check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table annuaire.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references annuaire.events(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  activity text not null,
  grp text not null default '',
  email text not null,
  phone text not null default '',
  share_profile boolean not null,
  share_contact boolean not null default false,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  self_token uuid not null unique default gen_random_uuid(),
  constraint entries_names check (char_length(first_name) between 1 and 80 and char_length(last_name) between 1 and 80),
  constraint entries_activity check (char_length(activity) between 1 and 160),
  constraint entries_grp check (char_length(grp) <= 80),
  constraint entries_email check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint entries_phone check (char_length(phone) <= 30),
  -- Figurer dans l'annuaire est l'objet même du formulaire : sans ce
  -- consentement, rien n'est enregistré.
  constraint entries_consent check (share_profile)
);
create unique index entries_event_email on annuaire.entries (event_id, lower(email));

alter table annuaire.events enable row level security;
alter table annuaire.entries enable row level security;
-- Aucune policy : aucun accès direct aux tables, même en cas d'exposition du schéma.

-- ---------------------------------------------------------------------------
-- Fonctions internes

-- Durée de conservation : un an après la soirée.
create function annuaire.purge_expired() returns void
language sql security definer set search_path = '' as $$
  delete from annuaire.entries e
  using annuaire.events ev
  where e.event_id = ev.id and ev.event_date + interval '1 year' < now();
$$;

create function annuaire.check_admin(p_slug text, p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from annuaire.events
   where slug = p_slug
     and admin_key_hash is not null
     and admin_key_hash = extensions.crypt(coalesce(p_key, ''), admin_key_hash);
  if v_id is null then
    perform pg_sleep(0.8); -- ralentit les essais au hasard
    raise exception 'acces_refuse';
  end if;
  return v_id;
end $$;

revoke all on function annuaire.purge_expired() from public, anon, authenticated;
revoke all on function annuaire.check_admin(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Formulaire public

create function public.annuaire_event(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform annuaire.purge_expired();
  select jsonb_build_object(
           'title', title,
           'event_date', event_date,
           'controller', controller,
           'contact_email', contact_email,
           'is_open', is_open and contact_email is not null,
           'retention_until', (event_date + interval '1 year')::date,
           'claimed', admin_key_hash is not null)
    into v from annuaire.events where slug = p_slug;
  if v is null then raise exception 'evenement_introuvable'; end if;
  return v;
end $$;

create function public.annuaire_submit(
  p_slug text, p_first_name text, p_last_name text, p_activity text, p_grp text,
  p_email text, p_phone text, p_share_profile boolean, p_share_contact boolean,
  p_consent_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_event annuaire.events;
  v_token uuid;
begin
  select * into v_event from annuaire.events where slug = p_slug;
  if v_event.id is null then raise exception 'evenement_introuvable'; end if;
  if not v_event.is_open or v_event.contact_email is null then raise exception 'formulaire_ferme'; end if;
  if not coalesce(p_share_profile, false) then raise exception 'consentement_requis'; end if;
  if (select count(*) from annuaire.entries where event_id = v_event.id) >= 1000 then
    raise exception 'complet';
  end if;
  if exists (select 1 from annuaire.entries
              where event_id = v_event.id and lower(email) = lower(trim(p_email))) then
    raise exception 'deja_inscrit';
  end if;

  insert into annuaire.entries
    (event_id, first_name, last_name, activity, grp, email, phone,
     share_profile, share_contact, consent_version)
  values
    (v_event.id, trim(p_first_name), trim(p_last_name), trim(p_activity),
     trim(coalesce(p_grp, '')), lower(trim(p_email)), trim(coalesce(p_phone, '')),
     true, coalesce(p_share_contact, false), coalesce(p_consent_version, ''))
  returning self_token into v_token;

  return jsonb_build_object('token', v_token);
end $$;

-- Espace personnel, par le lien remis après l'inscription.

create function public.annuaire_me(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform annuaire.purge_expired();
  select jsonb_build_object(
           'first_name', e.first_name, 'last_name', e.last_name, 'activity', e.activity,
           'grp', e.grp, 'email', e.email, 'phone', e.phone,
           'share_contact', e.share_contact, 'consented_at', e.consented_at,
           'event', jsonb_build_object(
             'title', ev.title, 'event_date', ev.event_date, 'controller', ev.controller,
             'contact_email', ev.contact_email,
             'retention_until', (ev.event_date + interval '1 year')::date))
    into v
    from annuaire.entries e join annuaire.events ev on ev.id = e.event_id
   where e.self_token = p_token;
  if v is null then raise exception 'inscription_introuvable'; end if;
  return v;
end $$;

create function public.annuaire_update_me(
  p_token uuid, p_first_name text, p_last_name text, p_activity text, p_grp text,
  p_email text, p_phone text, p_share_contact boolean, p_consent_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_entry annuaire.entries;
begin
  select * into v_entry from annuaire.entries where self_token = p_token;
  if v_entry.id is null then raise exception 'inscription_introuvable'; end if;
  if exists (select 1 from annuaire.entries
              where event_id = v_entry.event_id and id <> v_entry.id
                and lower(email) = lower(trim(p_email))) then
    raise exception 'deja_inscrit';
  end if;
  update annuaire.entries set
    first_name = trim(p_first_name), last_name = trim(p_last_name),
    activity = trim(p_activity), grp = trim(coalesce(p_grp, '')),
    email = lower(trim(p_email)), phone = trim(coalesce(p_phone, '')),
    share_contact = coalesce(p_share_contact, false),
    consent_version = coalesce(p_consent_version, ''),
    consented_at = now(), updated_at = now()
  where id = v_entry.id;
end $$;

-- Retrait du consentement : l'inscription est effacée, pas seulement masquée.
create function public.annuaire_delete_me(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from annuaire.entries where self_token = p_token;
  if not found then raise exception 'inscription_introuvable'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Organisateur : une clé choisie par lui, jamais stockée en clair.

create function public.annuaire_claim(p_slug text, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(p_key, '')) < 12 then raise exception 'cle_trop_courte'; end if;
  update annuaire.events
     set admin_key_hash = extensions.crypt(p_key, extensions.gen_salt('bf'))
   where slug = p_slug and admin_key_hash is null;
  if not found then raise exception 'deja_revendique'; end if;
end $$;

create function public.annuaire_admin(p_slug text, p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v jsonb;
begin
  v_id := annuaire.check_admin(p_slug, p_key);
  perform annuaire.purge_expired();
  select jsonb_build_object(
           'title', ev.title, 'event_date', ev.event_date, 'controller', ev.controller,
           'contact_email', ev.contact_email, 'is_open', ev.is_open,
           'retention_until', (ev.event_date + interval '1 year')::date,
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', e.id, 'first_name', e.first_name, 'last_name', e.last_name,
                      'activity', e.activity, 'grp', e.grp, 'email', e.email, 'phone', e.phone,
                      'share_contact', e.share_contact, 'consented_at', e.consented_at)
                    order by lower(e.last_name), lower(e.first_name))
               from annuaire.entries e where e.event_id = ev.id), '[]'::jsonb))
    into v from annuaire.events ev where ev.id = v_id;
  return v;
end $$;

create function public.annuaire_admin_update(
  p_slug text, p_key text, p_contact_email text, p_is_open boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := annuaire.check_admin(p_slug, p_key);
  update annuaire.events set
    contact_email = nullif(lower(trim(coalesce(p_contact_email, ''))), ''),
    is_open = coalesce(p_is_open, false)
  where id = v_id;
end $$;

create function public.annuaire_admin_delete_entry(p_slug text, p_key text, p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := annuaire.check_admin(p_slug, p_key);
  delete from annuaire.entries where id = p_entry and event_id = v_id;
end $$;

create function public.annuaire_admin_purge(p_slug text, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := annuaire.check_admin(p_slug, p_key);
  delete from annuaire.entries where event_id = v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution : uniquement ces fonctions, uniquement par l'API.

revoke all on function public.annuaire_event(text) from public;
revoke all on function public.annuaire_submit(text, text, text, text, text, text, text, boolean, boolean, text) from public;
revoke all on function public.annuaire_me(uuid) from public;
revoke all on function public.annuaire_update_me(uuid, text, text, text, text, text, text, boolean, text) from public;
revoke all on function public.annuaire_delete_me(uuid) from public;
revoke all on function public.annuaire_claim(text, text) from public;
revoke all on function public.annuaire_admin(text, text) from public;
revoke all on function public.annuaire_admin_update(text, text, text, boolean) from public;
revoke all on function public.annuaire_admin_delete_entry(text, text, uuid) from public;
revoke all on function public.annuaire_admin_purge(text, text) from public;

grant execute on function public.annuaire_event(text) to anon, authenticated;
grant execute on function public.annuaire_submit(text, text, text, text, text, text, text, boolean, boolean, text) to anon, authenticated;
grant execute on function public.annuaire_me(uuid) to anon, authenticated;
grant execute on function public.annuaire_update_me(uuid, text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.annuaire_delete_me(uuid) to anon, authenticated;
grant execute on function public.annuaire_claim(text, text) to anon, authenticated;
grant execute on function public.annuaire_admin(text, text) to anon, authenticated;
grant execute on function public.annuaire_admin_update(text, text, text, boolean) to anon, authenticated;
grant execute on function public.annuaire_admin_delete_entry(text, text, uuid) to anon, authenticated;
grant execute on function public.annuaire_admin_purge(text, text) to anon, authenticated;
