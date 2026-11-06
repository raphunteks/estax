import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { decrypt, encrypt } from "./crypto";
import { saveUser, type User } from "./users";

export async function newSetup(email: string) {
  const secret = generateSecret();
  const uri = generateURI({ issuer: "Estaka Dental Clinic", label: email, secret });
  return { secret, enc: encrypt(secret), qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

/** Verifies a 6-digit code (±90s tolerance for mobile clock drifts) and blocks replay of an already-used step. Returns the new step or null. */
export async function checkTotp(user: User, code: string): Promise<number | null> {
  if (!user.totpSecretEnc || !/^\d{6}$/.test(code)) return null;
  try {
    const plain = decrypt(user.totpSecretEnc);
    if (!plain) return null;
    const r = await verify({ secret: plain, token: code, epochTolerance: 90 });
    if (!r.valid) return null;
    const step = (r as { timeStep?: number }).timeStep ?? Math.floor(Date.now() / 30000);
    return step !== user.lastTotpStep ? step : null;
  } catch (err) {
    console.error("[checkTotp] verification error:", err);
    return null;
  }
}

export function makeBackupCodes(n = 10) {
  const codes = Array.from({ length: n }, () => {
    const b = crypto.randomBytes(5).toString("hex");
    return `${b.slice(0, 5)}-${b.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => bcrypt.hashSync(c, 8)) };
}
export async function consumeBackupCode(user: User, input: string): Promise<boolean> {
  const code = input.trim().toLowerCase();
  const i = user.backupHashes.findIndex((h) => bcrypt.compareSync(code, h));
  if (i < 0) return false;
  user.backupHashes.splice(i, 1);
  await saveUser(user);
  return true;
}
