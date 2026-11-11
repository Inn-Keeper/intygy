import { createHmac, timingSafeEqual } from "node:crypto";

const LIFETIME_SECONDS = 30 * 24 * 60 * 60;

function sign(secret: string, projectId: string, exp: string | number): string {
  return createHmac("sha256", secret).update(`${projectId}.${exp}`).digest("hex");
}

/** Query string granting 30 days of access to every page of one project. */
export function linkQuery(secret: string, projectId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + LIFETIME_SECONDS;

  return `?exp=${exp}&sig=${sign(secret, projectId, exp)}`;
}

export function validLink(secret: string, projectId: string, exp?: string, sig?: string, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;

  const given = Buffer.from(sig), expected = Buffer.from(sign(secret, projectId, exp));

  return given.length === expected.length && timingSafeEqual(given, expected);
}
