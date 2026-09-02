export type Role = "P" | "D" | "C" | "A";

export type Player = {
  id: number;
  name: string;
  role: Role;
  club: string;
  quotation?: number | null;
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