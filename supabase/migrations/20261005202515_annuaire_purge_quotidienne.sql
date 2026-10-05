-- Respect de la durée de conservation annoncée dans le formulaire, même si
-- plus personne n'ouvre l'annuaire : purge quotidienne à 3 h 17.
create extension if not exists pg_cron;
select cron.schedule('annuaire-purge-retention', '17 3 * * *', $$select annuaire.purge_expired()$$);
