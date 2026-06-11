// src/registrars/linkintime.ts
// Link Intime Registrar Adapter — alias of MUFG Intime.
//
// Link Intime India was acquired by MUFG and rebranded "MUFG Intime India"
// in 2024; linkintime.co.in now serves from in.mpms.mufg.com. This adapter
// exists so IPO metadata stored with registrar "linkintime" keeps working —
// all calls are served by the MUFG implementation.

import { MUFGAdapter } from "./mufg";
import { IPO } from "@/types/ipo.types";

export class LinkInTimeAdapter extends MUFGAdapter {
  readonly name: string = "linkintime";
  readonly displayName: string = "Link Intime India (now MUFG Intime)";

  async getActiveIPOs(): Promise<IPO[]> {
    // Discovery is owned by the MUFG adapter; returning the same list here
    // would duplicate every IPO in the merged catalogue.
    return [];
  }
}

export const linkInTimeAdapter = new LinkInTimeAdapter();
