import { z } from "zod";
import { json, fail } from "@/lib/api";
import { getUser, saveUser } from "@/lib/auth/users";
import { getPreAuth, startSession } from "@/lib/auth/session";
import { audit, clearFailures, failures, rateLimit } from "@/lib/auth/guards";
import { checkTotp, consumeBackupCode } from "@/lib/auth/totp";
import { accountFor, homeFor } from "@/lib/auth/rbac";

const body = z.object({ code: z.string().min(6).max(20) });

export async function POST(req: Request) {
  try {
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail("validation", 400, "Format kode salah. Masukkan 6 digit angka atau kode cadangan.");
    const uid = await getPreAuth();
    if (!uid) return fail("expired", 401, "Sesi verifikasi telah berakhir. Silakan masuk ulang.");
    if ((await failures("totp-fail", uid)) >= 5) return fail("locked", 429, "Terlalu banyak percobaan salah. Coba lagi dalam 15 menit.");

    const user = await getUser(uid);
    if (!user || !user.active || !user.totpEnabled) return fail("expired", 401, "Sesi akun tidak valid atau 2FA belum aktif.");

    const code = p.data.code.trim();
    const isSixDigit = /^\d{6}$/.test(code);
    const step = isSixDigit ? await checkTotp(user, code) : null;
    let ok = step !== null;
    if (ok) {
      user.lastTotpStep = step as number;
      await saveUser(user);
    } else {
      // Also try consuming backup code (even if 6 digits or hyphenated format)
      ok = await consumeBackupCode(user, code);
      if (ok) await audit("login.backup-code", user.id);
    }

    if (!ok) {
      await rateLimit("totp-fail", uid, 5, 900);
      await audit("totp.fail", uid);
      return fail("invalid", 401, "Kode 6 digit salah atau sudah kedaluwarsa. Pastikan jam HP Anda akurat, atau gunakan kode cadangan.");
    }

    await clearFailures("totp-fail", uid);
    await startSession(user.id);
    await audit("login.ok", user.id, { totp: true });
    return json({ ok: true, next: user.mustChangePassword ? accountFor(user.role) : homeFor(user.role) });
  } catch (err) {
    console.error("[api/auth/totp] Error:", err);
    return fail("invalid", 401, "Terjadi kendala verifikasi kode. Silakan gunakan kode terbaru atau kode cadangan.");
  }
}
