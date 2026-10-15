-- Présentation détaillée de l'activité, rédigée par l'organisateur à partir
-- de l'activité saisie. L'activité d'origine reste celle du participant.
alter table annuaire.entries add column activity_detail text not null default '';

-- Si le participant modifie son activité, la présentation détaillée ne la
-- décrit plus : elle est retirée plutôt que de rester fausse.
create function annuaire.reset_activity_detail() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.activity is distinct from old.activity then new.activity_detail := ''; end if;
  return new;
end $$;

create trigger entries_reset_activity_detail
  before update of activity on annuaire.entries
  for each row execute function annuaire.reset_activity_detail();

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
                      'email', case when e.share_contact then e.email else '' end,
                      'phone', case when e.share_contact then e.phone else '' end,
                      'share_contact', e.share_contact)
                    order by lower(e.last_name), lower(e.first_name))
               from annuaire.entries e where e.event_id = ev.id), '[]'::jsonb))
    into v from annuaire.events ev where ev.id = v_entry.event_id;
  return v;
end $$;
