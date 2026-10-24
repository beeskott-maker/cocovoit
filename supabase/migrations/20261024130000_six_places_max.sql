-- Au plus 6 places passagers par voiture (au lieu de 8). Aucune voiture
-- existante n'en a plus de 6 : la nouvelle contrainte s'applique sans retouche.

alter table public.cars drop constraint cars_seats_check;
alter table public.cars add constraint cars_seats_check check (seats between 1 and 6);
