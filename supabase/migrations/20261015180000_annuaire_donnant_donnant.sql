-- Donnant-donnant : qui ne partage pas ses coordonnées ne voit pas celles des
-- autres. Il garde les noms, activités et associations, et peut choisir de
-- partager les siennes depuis l'annuaire pour débloquer celles des autres.

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
               from annuaire.entries e where e.event_id = ev.id), '[]'::jsonb))
    into v from annuaire.events ev where ev.id = v_entry.event_id;
  return v;
end $$;

-- Le participant accepte, depuis l'annuaire, de partager ses coordonnées.
create function public.annuaire_reader_share(
  p_slug text, p_code text, p_email text, p_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_entry annuaire.entries;
begin
  if char_length(coalesce(p_version, '')) = 0 then raise exception 'engagement_requis'; end if;
  v_entry := annuaire.check_reader(p_slug, p_code, p_email);
  update annuaire.entries
     set share_contact = true, consent_version = left(p_version, 64), updated_at = now()
   where id = v_entry.id;
end $$;

revoke all on function public.annuaire_reader_share(text, text, text, text) from public;
grant execute on function public.annuaire_reader_share(text, text, text, text) to anon, authenticated;
