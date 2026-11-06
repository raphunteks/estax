import nodemailer from "nodemailer";
import { getBaseUrl } from "@/lib/origin";

const configured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);

/** Gmail SMTP via App Password. In dev without SMTP the message is printed (never in production). */
export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!configured()) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP not configured");
    console.log(`\n[mail:dev] to=${to}\nsubject=${subject}\n${text}\n`);
    return;
  }
  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD } });
  await t.sendMail({ from: process.env.MAIL_FROM || `Estaka Dental Clinic <${process.env.SMTP_USER}>`, to, subject, html, text });
}

export const siteUrl = (req?: Request) => getBaseUrl(req);

export function resetEmail(link: string) {
  return {
    subject: "Atur ulang kata sandi Estaka Dental Clinic",
    text: `Gunakan tautan berikut untuk mengatur kata sandi (berlaku 1 jam):\n${link}\n\nJika bukan Anda yang meminta, abaikan email ini.`,
    html: `<p>Gunakan tautan berikut untuk mengatur kata sandi (berlaku 1 jam):</p><p><a href="${link}">Atur kata sandi</a></p><p>Jika bukan Anda yang meminta, abaikan email ini.</p>`,
  };
}

const wrap = (subject: string, text: string, link: string, label: string) => ({
  subject,
  text: `${text}\n${link}`,
  html: `<p>${text.replace(/\n/g, "<br>")}</p><p><a href="${link}">${label}</a></p>`,
});
export const inviteEmail = (link: string, name: string, role: string) =>
  wrap("Undangan akun Estaka Dental Clinic", `Halo ${name}, Anda diundang sebagai ${role}. Atur kata sandi Anda lewat tautan berikut (berlaku 72 jam):`, link, "Atur kata sandi");
export const verifyEmail = (link: string, name: string) =>
  wrap("Verifikasi email Estaka Dental Clinic", `Halo ${name}, konfirmasi email Anda untuk mengaktifkan akun pasien (berlaku 24 jam):`, link, "Verifikasi email");
