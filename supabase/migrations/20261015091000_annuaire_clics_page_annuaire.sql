-- La carte « Par Agalumy » figure aussi sur la page de l'annuaire.
alter table annuaire.clicks drop constraint clicks_page_check;
alter table annuaire.clicks add constraint clicks_page_check check (page in ('form', 'thanks', 'directory'));

create or replace function public.annuaire_track_click(p_slug text, p_page text) returns void
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
  values (v_id, case when p_page in ('thanks', 'directory') then p_page else 'form' end);
end $$;
