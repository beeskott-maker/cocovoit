-- Nouvelle purge ponctuelle des données de test (voir 20261023150000).
-- Supprimer les voyages supprime en cascade participants, voitures,
-- trajets et réservations. Sans effet sur une base neuve.
delete from public.trips;
