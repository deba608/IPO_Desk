// src/types/ipo.types.ts
export interface IPO {
  clientId: string;
  name: string;
  registrar: "kfintech" | "linkintime" | "bigshare" | "mufg";
}

export interface IPOListResponse {
  ipos: IPO[];
  total: number;
  lastUpdated: string;
}
