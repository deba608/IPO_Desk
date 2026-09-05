// src/features/ipo-checker/utils/pan-validator.ts
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isValidPAN(pan: string): boolean {
  return PAN_REGEX.test(pan.toUpperCase().trim());
}

export function parsePANsFromText(text: string): {
  valid: string[];
  invalid: string[];
  duplicates: string[];
} {
  // Split on whitespace, commas, semicolons, and newlines
  const tokens = text
    .split(/[\s,;\n\r]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];

  for (const token of tokens) {
    if (!isValidPAN(token)) {
      if (token.length > 0) invalid.push(token);
      continue;
    }

    if (seen.has(token)) {
      duplicates.push(token);
      continue;
    }

    seen.add(token);
    valid.push(token);
  }

  return { valid, invalid, duplicates };
}
