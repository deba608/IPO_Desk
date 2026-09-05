// src/types/ipo.types.ts
export type RegistrarName =
  | "kfintech"
  | "linkintime"
  | "bigshare"
  | "mufg"
  | "skyline"
  | "purva"
  | "maashitla";

export interface IPO {
  /** Stable identifier: `${registrar}-${clientId}` */
  id: string;
  clientId: string;
  name: string;
  registrar: RegistrarName;
  status: "ACTIVE";
  /** ISO timestamp of the sync that produced this record */
  lastSyncedAt: string;
}

export interface IPOListResponse {
  ipos: IPO[];
  total: number;
  lastUpdated: string;
}
