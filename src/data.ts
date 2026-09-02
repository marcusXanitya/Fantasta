export type Role = "P" | "D" | "C" | "A";

export type RoleLimits = Record<
  Role,
  number
>;

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