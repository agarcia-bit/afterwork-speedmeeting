-- Compteur de clics sur la carte « Par Agalumy » du formulaire public.
-- On ne garde que la date, la page d'origine et la soirée : aucune donnée
-- qui identifie la personne, donc rien qui demande un consentement.

create table annuaire.clicks (
  id bigint generated always as identity primary key,
  event_id uuid not null references annuaire.events(id) on delete cascade,
  page text not null check (page in ('form', 'thanks')),
  clicked_at timestamptz not null default now()
);
create index clicks_event_time on annuaire.clicks (event_id, clicked_at);

alter table annuaire.clicks enable row level security;
-- Aucune policy : comme les inscriptions, accessible seulement par fonctions.

-- Purge : les clics suivent la même durée de conservation que les réponses.
create or replace function annuaire.purge_expired() returns void
language sql security definer set search_path = '' as $$
  delete from annuaire.entries e
  using annuaire.events ev
  where e.event_id = ev.id and ev.event_date + interval '1 year' < now();
  delete from annuaire.clicks c
  using annuaire.events ev
  where c.event_id = ev.id and ev.event_date + interval '1 year' < now();
$$;

-- Enregistrement d'un clic, appelable par le public. Garde-fou contre le
-- gonflage par un script : au-delà de 60 clics par minute pour une soirée,
-- les suivants sont ignorés sans erreur.
create function public.annuaire_track_click(p_slug text, p_page text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from annuaire.events where slug = p_slug;
  if v_id is null then return; end if;
  if (select count(*) from annuaire.clicks
       where event_id = v_id and clicked_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into annuaire.clicks (event_id, page)
  values (v_id, case when p_page = 'thanks' then 'thanks' else 'form' end);
end $$;

revoke all on function public.annuaire_track_click(text, text) from public;
grant execute on function public.annuaire_track_click(text, text) to anon, authenticated;

-- Panneau organisateur : les clics s'ajoutent aux réponses.
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
                      'share_contact', e.share_contact, 'consented_at', e.consented_at)
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
                        group by 1 order by 1 desc limit 14) d), '[]'::jsonb)))
    into v from annuaire.events ev where ev.id = v_id;
  return v;
end $$;
