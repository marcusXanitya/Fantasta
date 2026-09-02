export type Role = "P" | "D" | "C" | "A";

export type Player = {
  id: number;
  name: string;
  role: Role;
  club: string;
  price?: number;
};

export type Team = {
  id: number;
  name: string;
  startingCredits: number;
  players: Player[];
};

export const roleLimits: Record<Role, number> = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

export const initialTeams: Team[] = [
  {
    id: 1,
    name: "Scrotone",
    startingCredits: 500,
    players: [],
  },
  {
    id: 2,
    name: "FC Mario",
    startingCredits: 500,
    players: [],
  },
  {
    id: 3,
    name: "Dinamo",
    startingCredits: 500,
    players: [],
  },
  {
    id: 4,
    name: "Atletico Barriera",
    startingCredits: 500,
    players: [],
  },
  {
    id: 5,
    name: "Real Porta Palazzo",
    startingCredits: 500,
    players: [],
  },
  {
    id: 6,
    name: "Sporting Dora",
    startingCredits: 500,
    players: [],
  },
  {
    id: 7,
    name: "Borgo FC",
    startingCredits: 500,
    players: [],
  },
  {
    id: 8,
    name: "San Salvario",
    startingCredits: 500,
    players: [],
  },
  {
    id: 9,
    name: "Aurora 1912",
    startingCredits: 500,
    players: [],
  },
  {
    id: 10,
    name: "Madama FC",
    startingCredits: 500,
    players: [],
  },
];

export const availablePlayers: Player[] = [
  { id: 1, name: "Lautaro Martínez", role: "A", club: "Inter" },
  { id: 2, name: "Marcus Thuram", role: "A", club: "Inter" },
  { id: 3, name: "Dusan Vlahovic", role: "A", club: "Juventus" },
  { id: 4, name: "Riccardo Orsolini", role: "C", club: "Bologna" },
  { id: 5, name: "Christian Pulisic", role: "C", club: "Milan" },
  { id: 6, name: "Nicolò Barella", role: "C", club: "Inter" },
  { id: 7, name: "Federico Dimarco", role: "D", club: "Inter" },
  { id: 8, name: "Alessandro Bastoni", role: "D", club: "Inter" },
  { id: 9, name: "Gleison Bremer", role: "D", club: "Juventus" },
  { id: 10, name: "Mile Svilar", role: "P", club: "Roma" },
  { id: 11, name: "David De Gea", role: "P", club: "Fiorentina" },
  { id: 12, name: "Marco Carnesecchi", role: "P", club: "Atalanta" },
  { id: 13, name: "Scott McTominay", role: "C", club: "Napoli" },
  { id: 14, name: "Paulo Dybala", role: "A", club: "Roma" },
  { id: 15, name: "Giovanni Di Lorenzo", role: "D", club: "Napoli" },
];