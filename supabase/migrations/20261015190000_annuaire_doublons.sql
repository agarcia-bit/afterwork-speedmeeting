-- Doublons : une personne inscrite deux fois (souvent avec deux adresses) n'a
-- plus qu'une fiche dans l'annuaire. La fiche en double reste en base pour que
-- ses deux adresses ouvrent l'annuaire ; elle est retirée avec la principale.
alter table annuaire.entries
  add column duplicate_of uuid references annuaire.entries (id) on delete cascade;

-- Une adresse de doublon ouvre l'annuaire au nom de la fiche principale.
create or replace function annuaire.check_reader(p_slug text, p_code text, p_email text)
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
   where event_id = v_event.id and lower(email) = lower(trim(coalesce(p_email, '')))
   order by duplicate_of nulls first
   limit 1;
  if v_entry.id is null then
    perform pg_sleep(0.8); -- ralentit les essais d'adresses au hasard
    raise exception 'adresse_inconnue';
  end if;
  if v_entry.duplicate_of is not null then
    select * into v_entry from annuaire.entries where id = v_entry.duplicate_of;
  end if;
  return v_entry;
end $$;
revoke all on function annuaire.check_reader(text, text, text) from public, anon, authenticated;

create or replace function public.annuaire_reader_check(p_slug text, p_code text, p_email text)
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
    'count', (select count(*) from annuaire.entries
               where event_id = v_event.id and duplicate_of is null));
end $$;

create or replace function public.annuaire_reader_open(
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
                      'activity', e.activity, 'activity_detail', e.activity_detail, 'grp', e.grp,
                      'email', case when e.share_contact and (v_entry.share_contact or e.id = v_entry.id)
                                    then e.email else '' end,
                      'phone', case when e.share_contact and (v_entry.share_contact or e.id = v_entry.id)
                                    then e.phone else '' end,
                      'share_contact', e.share_contact)
                    order by lower(e.last_name), lower(e.first_name))
               from annuaire.entries e
              where e.event_id = ev.id and e.duplicate_of is null), '[]'::jsonb))
    into v from annuaire.events ev where ev.id = v_entry.event_id;
  return v;
end $$;

-- Panneau organisateur : chaque réponse indique si elle double une autre fiche.
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
                      'duplicate_of', e.duplicate_of,
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
