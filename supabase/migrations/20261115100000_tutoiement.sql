-- Tutoiement dans toute l'appli : emails et messages d'erreur renvoyés par la base.
-- Plutôt que recopier les fonctions (au risque d'en réécrire une version plus
-- ancienne), on remplace les phrases dans leur définition actuelle. Chaque
-- phrase doit être trouvée : sinon la migration échoue sans rien changer.

do $$
declare
  r record;
  v_def text;
  v_new text;
  v_pair text[];
begin
  for r in
    select * from (values
      ('_account', array[
        ['Session expirée, reconnectez-vous', 'Session expirée, reconnecte-toi']]),
      ('_participant', array[
        ['Vous ne participez pas à ce voyage', 'Tu ne participes pas à ce voyage']]),
      ('_start_email_verification', array[
        ['réessayez dans une heure', 'réessaie dans une heure']]),
      ('_send_verification_email', array[
        ['Confirmez que cette adresse est bien la vôtre ', 'Confirme que cette adresse est bien la tienne '],
        ['pour rejoindre vos voyages sur Coco·Voit.', 'pour rejoindre tes voyages sur Coco·Voit.'],
        ['Vous n''''avez rien demandé ? Ignorez simplement cet email', 'Tu n''''as rien demandé ? Ignore simplement cet email'],
        ['Vous n''''avez rien demandé ? Ignorez cet email.', 'Tu n''''as rien demandé ? Ignore cet email.'],
        ['Confirmez votre adresse email', 'Confirme ton adresse email']]),
      ('email_trip_recap', array[
        ['réessayez dans une heure', 'réessaie dans une heure'],
        ['Vous n''''avez pas de place dans ce voyage', 'Tu n''''as pas de place dans ce voyage'],
        ['Libérez vos places depuis la page du voyage.', 'Libère tes places depuis la page du voyage.'],
        ['Vous recevez cet email parce que vous l''''avez demandé', 'Tu reçois cet email parce que tu l''''as demandé'],
        ['Votre voyage', 'Ton voyage']]),
      ('_new_passenger_email', array[
        ['Vous recevez cet email parce que vous proposez une voiture', 'Tu reçois cet email parce que tu proposes une voiture'],
        ['votre voiture', 'ta voiture']]),
      ('save_car', array[
        ['Vous avez une place de passager : libérez-la pour ajouter votre voiture', 'Tu as une place de passager : libère-la pour ajouter ta voiture'],
        ['Indiquez au moins un trajet', 'Indique au moins un trajet']]),
      ('take_seat', array[
        ['Vous avez déjà une place %', 'Tu as déjà une place %'],
        ['Vous conduisez une voiture : vous ne pouvez pas être passager', 'Tu conduis une voiture : tu ne peux pas être passager']])
    ) as t(fn, pairs)
  loop
    select pg_get_functiondef(p.oid) into strict v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = r.fn;
    v_new := v_def;
    foreach v_pair slice 1 in array r.pairs loop
      if strpos(v_new, v_pair[1]) = 0 then
        raise exception 'Tutoiement : « % » introuvable dans %', v_pair[1], r.fn;
      end if;
      v_new := replace(v_new, v_pair[1], v_pair[2]);
    end loop;
    execute v_new;
  end loop;
end;
$$;
