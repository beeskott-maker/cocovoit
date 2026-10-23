-- Purge ponctuelle des données de test saisies avant la mise en service.
-- Supprimer les voyages supprime en cascade participants, voitures,
-- trajets et réservations. Sans effet sur une base neuve.
delete from public.trips;
