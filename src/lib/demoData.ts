import type { Direction } from './types';

/**
 * Jeu de données de démonstration de l'environnement de test (/dev/).
 * « moi » désigne la personne connectée : elle est ajoutée aux voyages lors
 * de sa première connexion sur une base démo vide. Rien n'est inséré en production.
 */
export const DEMO_PEOPLE: Record<string, string> = {
  hugo: 'Hugo',
  julie: 'Julie',
  sarah: 'Sarah',
  thomas: 'Thomas',
  camille: 'Camille',
  antoine: 'Antoine',
};
export const ME = 'moi';

export interface DemoLeg {
  at: string;
  rdv?: string;
  passengers: string[];
}
export interface DemoTrip {
  name: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  organizer: string;
  people: string[];
  cars: { driver: string; seats: number; legs: Partial<Record<Direction, DemoLeg>> }[];
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    name: 'Week-end à Annecy',
    destination: '12 rue Sainte-Claire, 74000 Annecy',
    startsOn: '2026-11-14',
    endsOn: '2026-11-15',
    organizer: ME,
    people: [ME, 'hugo', 'julie', 'sarah', 'thomas'],
    cars: [
      {
        driver: ME,
        seats: 3,
        legs: {
          aller: { at: '2026-11-14T08:00:00+01:00', rdv: 'Gare Part-Dieu, Lyon', passengers: ['julie', 'sarah'] },
          retour: { at: '2026-11-15T17:00:00+01:00', passengers: ['julie'] },
        },
      },
      {
        driver: 'hugo',
        seats: 4,
        legs: {
          aller: { at: '2026-11-14T09:30:00+01:00', rdv: 'Place Bellecour, Lyon', passengers: ['thomas'] },
          retour: { at: '2026-11-15T18:00:00+01:00', passengers: ['thomas', 'sarah'] },
        },
      },
    ],
  },
  {
    name: 'Ski à Val Thorens',
    destination: 'Résidence Le Hameau du Kashmir, 73440 Val Thorens',
    startsOn: '2027-01-23',
    endsOn: '2027-01-30',
    organizer: 'julie',
    people: ['julie', ME, 'thomas', 'camille', 'antoine'],
    cars: [
      {
        driver: 'thomas',
        seats: 4,
        legs: {
          aller: { at: '2027-01-23T07:00:00+01:00', rdv: 'Parking du métro Vaulx-en-Velin La Soie', passengers: [ME, 'julie'] },
          retour: { at: '2027-01-30T14:00:00+01:00', passengers: [ME, 'julie', 'camille'] },
        },
      },
      {
        driver: 'antoine',
        seats: 3,
        legs: {
          aller: { at: '2027-01-23T08:00:00+01:00', rdv: 'Gare de Chambéry', passengers: ['camille'] },
        },
      },
    ],
  },
  {
    name: 'Anniversaire de Camille',
    destination: '24 rue de Marseille, 69007 Lyon',
    startsOn: '2026-12-05',
    endsOn: '2026-12-06',
    organizer: 'camille',
    people: ['camille', ME, 'hugo', 'sarah'],
    cars: [
      {
        driver: 'sarah',
        seats: 2,
        legs: {
          aller: { at: '2026-12-05T19:00:00+01:00', rdv: 'Métro Saxe-Gambetta', passengers: [ME, 'hugo'] },
        },
      },
    ],
  },
  {
    name: 'Jazz à Vienne',
    destination: 'Théâtre antique, 38200 Vienne',
    startsOn: '2026-07-04',
    endsOn: '2026-07-04',
    organizer: 'hugo',
    people: ['hugo', ME, 'julie'],
    cars: [
      {
        driver: 'hugo',
        seats: 3,
        legs: {
          aller: { at: '2026-07-04T18:00:00+02:00', rdv: 'Gare Jean-Macé, Lyon', passengers: [ME, 'julie'] },
          retour: { at: '2026-07-05T00:30:00+02:00', passengers: [ME, 'julie'] },
        },
      },
    ],
  },
  {
    name: 'Mariage de Sarah et Antoine',
    destination: 'Domaine des Grillons, 69430 Beaujeu',
    startsOn: '2027-06-12',
    endsOn: '2027-06-13',
    organizer: ME,
    people: [ME, 'sarah', 'antoine'],
    cars: [],
  },
];
