// src/registrars/registry.ts
// Single source of truth for available registrar adapters. New registrars
// are added here and nowhere else — the frontend, IPO catalogue, and check
// pipeline all resolve adapters through this registry.

import { RegistrarAdapter } from "./adapter.interface";
import { kfinTechAdapter } from "./kfintech";
import { linkInTimeAdapter } from "./linkintime";
import { bigShareAdapter } from "./bigshare";
import { mufgAdapter } from "./mufg";

export const REGISTRAR_REGISTRY: Record<string, RegistrarAdapter> = {
  kfintech: kfinTechAdapter,
  linkintime: linkInTimeAdapter,
  bigshare: bigShareAdapter,
  mufg: mufgAdapter,
};

export function getAdapter(registrarName: string): RegistrarAdapter {
  const adapter = REGISTRAR_REGISTRY[registrarName];
  if (!adapter) {
    throw new Error(`Unknown registrar: ${registrarName}`);
  }
  return adapter;
}

export function listAdapters(): RegistrarAdapter[] {
  return Object.values(REGISTRAR_REGISTRY);
}
