"use server";

import { redirect } from "next/navigation";
import { adminPasswordMatches, createAdminSession, hasAdminPassword } from "@/lib/admin-auth";

export async function loginAction(_previousState, formData) {
  if (!hasAdminPassword()) {
    return { error: "ADMIN_PASSWORD is not set. Admin is currently open." };
  }

  const password = String(formData.get("password") || "");
  if (!adminPasswordMatches(password)) {
    return { error: "Wrong password." };
  }

  await createAdminSession();
  redirect("/admin");
}
