import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE = "kalshi_admin_session";

function sessionValue() {
  const password = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function hasAdminPassword() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function isAdminAuthenticated() {
  if (!hasAdminPassword()) return true;
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === sessionValue();
}

export async function requireAdminAuth() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export async function createAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sessionValue(), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export function adminPasswordMatches(password) {
  return Boolean(process.env.ADMIN_PASSWORD) && password === process.env.ADMIN_PASSWORD;
}
