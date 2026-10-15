-- Diffusion de l'annuaire aux participants qui ont répondu au formulaire.
--
-- L'organisateur envoie lui-même un lien (campagne Brevo). Ce lien porte un
-- code secret propre à la diffusion, distinct du lien public du formulaire.
-- Pour accéder, il faut à la fois ce code et une adresse mail inscrite, puis
-- accepter l'engagement de confidentialité, dont l'acceptation est tracée.

alter table annuaire.events
  add column dist_code text,
  add column dist_open boolean not null default false;

create table annuaire.deliveries (
  id bigint generated always as identity primary key,
  entry_id uuid not null references annuaire.entries(id) on delete cascade,
  engagement_version text not null,
  accessed_at timestamptz not null default now()
);
create index deliveries_entry on annuaire.deliveries (entry_id);
alter table annuaire.deliveries enable row level security;
-- Aucune policy : accès uniquement par les fonctions ci-dessous.

-- Vérifie le lien et l'adresse ; renvoie l'inscription correspondante.
create function annuaire.check_reader(p_slug text, p_code text, p_email text)
returns annuaire.entries
language plpgsql security definer set search_path = '' as $$
declare v_event annuaire.events; v_entry annuaire.entries;
begin
  select * into v_event from annuaire.events where slug = p_slug;
  if v_event.id is null or not v_event.dist_open or v_event.dist_code is null
     or v_event.dist_code <> coalesce(p_code, '') then
    perform pg_sleep(0.8);
    raise exception 'acces_ferme';
  end if;
  select * into v_entry from annuaire.entries
   where event_id = v_event.id and lower(email) = lower(trim(coalesce(p_email, '')));
  if v_entry.id is null then
    perform pg_sleep(0.8); -- ralentit les essais d'adresses au hasard
    raise exception 'adresse_inconnue';
  end if;
  return v_entry;
end $$;
revoke all on function annuaire.check_reader(text, text, text) from public, anon, authenticated;

-- Étape 1 : « connexion » par l'adresse mail. Ne renvoie que le prénom.
create function public.annuaire_reader_check(p_slug text, p_code text, p_email text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_entry annuaire.entries; v_event annuaire.events;
begin
  v_entry := annuaire.check_reader(p_slug, p_code, p_email);
  select * into v_event from annuaire.events where id = v_entry.event_id;
  return jsonb_build_object(
    'first_name', v_entry.first_name,
    'title', v_event.title,
    'event_date', v_event.event_date,
    'count', (select count(*) from annuaire.entries where event_id = v_event.id));
end $$;

-- Étape 2 : engagement accepté → l'annuaire, limité à ce que chacun partage.
create function public.annuaire_reader_open(
  p_slug text, p_code text, p_email text, p_engagement text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_entry annuaire.entries; v jsonb;
begin
  if char_length(coalesce(p_engagement, '')) = 0 then raise exception 'engagement_requis'; end if;
  v_entry := annuaire.check_reader(p_slug, p_code, p_email);
  insert into annuaire.deliveries (entry_id, engagement_version) values (v_entry.id, p_engagement);

  select jsonb_build_object(
           'title', ev.title, 'event_date', ev.event_date,
           'me', v_entry.id,
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', e.id,
                      'first_name', e.first_name, 'last_name', e.last_name,
                      'activity', e.activity, 'grp', e.grp,
                      'email', case when e.share_contact then e.email else '' end,
                      'phone', case when e.share_contact then e.phone else '' end,
                      'share_contact', e.share_contact)
                    order by lower(e.last_name), lower(e.first_name))
               from annuaire.entries e where e.event_id = ev.id), '[]'::jsonb))
    into v from annuaire.events ev where ev.id = v_entry.event_id;
  return v;
end $$;

-- Organisateur : ouvrir ou fermer la diffusion ; le code est créé une fois.
create function public.annuaire_admin_distribution(p_slug text, p_key text, p_open boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  v_id := annuaire.check_admin(p_slug, p_key);
  update annuaire.events set
    dist_code = coalesce(dist_code, encode(extensions.gen_random_bytes(8), 'hex')),
    dist_open = coalesce(p_open, false)
  where id = v_id
  returning dist_code into v_code;
  return v_code;
end $$;

revoke all on function public.annuaire_reader_check(text, text, text) from public;
revoke all on function public.annuaire_reader_open(text, text, text, text) from public;
revoke all on function public.annuaire_admin_distribution(text, text, boolean) from public;
grant execute on function public.annuaire_reader_check(text, text, text) to anon, authenticated;
grant execute on function public.annuaire_reader_open(text, text, text, text) to anon, authenticated;
grant execute on function public.annuaire_admin_distribution(text, text, boolean) to anon, authenticated;

-- Panneau organisateur : état de la diffusion et nombre d'accès.
create or replace function public.annuaire_admin(p_slug text, p_key text) returns jsonb
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
                      'share_contact', e.share_contact, 'consented_at', e.consented_at,
                      'opened_at', (select max(d.accessed_at) from annuaire.deliveries d where d.entry_id = e.id))
                    order by lower(e.last_name), lower(e.first_name))
               from annuaire.entries e where e.event_id = ev.id), '[]'::jsonb),
           'clicks', jsonb_build_object(
             'total', (select count(*) from annuaire.clicks c where c.event_id = ev.id),
             'form', (select count(*) from annuaire.clicks c where c.event_id = ev.id and c.page = 'form'),
             'thanks', (select count(*) from annuaire.clicks c where c.event_id = ev.id and c.page = 'thanks'),
             'last', (select max(c.clicked_at) from annuaire.clicks c where c.event_id = ev.id),
             'by_day', coalesce((
               select jsonb_agg(jsonb_build_object('day', d.day, 'n', d.n) order by d.day desc)
                 from (select (c.clicked_at at time zone 'Europe/Paris')::date as day, count(*) as n
                         from annuaire.clicks c where c.event_id = ev.id
                        group by 1 order by 1 desc limit 14) d), '[]'::jsonb)),
           'distribution', jsonb_build_object(
             'open', ev.dist_open,
             'code', ev.dist_code,
             'readers', (select count(distinct d.entry_id) from annuaire.deliveries d
                           join annuaire.entries e on e.id = d.entry_id where e.event_id = ev.id),
             'last', (select max(d.accessed_at) from annuaire.deliveries d
                        join annuaire.entries e on e.id = d.entry_id where e.event_id = ev.id)))
    into v from annuaire.events ev where ev.id = v_id;
  return v;
end $$;
