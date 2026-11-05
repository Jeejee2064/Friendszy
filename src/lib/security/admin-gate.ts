// Cookie signé pour la porte d'accès partagée devant /admin.
// Format : `${userId}.${expiresAtMs}.${signatureHex}` — lié à l'utilisateur
// connecté et signé en HMAC-SHA256 : impossible à forger sans le secret serveur.
// Web Crypto uniquement (compatible proxy.ts et route handlers).

export const ADMIN_GATE_COOKIE = "admin_gate";
export const ADMIN_GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): string | null {
  return (
    process.env.ADMIN_GATE_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    null
  );
}

const encoder = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compare deux chaînes sans fuite de timing (via HMAC des deux côtés). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const secret = getSecret() ?? "fallback";
  const [ha, hb] = await Promise.all([hmacHex(a, secret), hmacHex(b, secret)]);
  return timingSafeEqualStr(ha, hb);
}

export async function createAdminGateToken(userId: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + ADMIN_GATE_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmacHex(payload, secret)}`;
}

export async function verifyAdminGateToken(
  token: string | undefined,
  userId: string
): Promise<boolean> {
  const secret = getSecret();
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  if (uid !== userId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacHex(`${uid}.${expStr}`, secret);
  return timingSafeEqualStr(expected, sig);
}
