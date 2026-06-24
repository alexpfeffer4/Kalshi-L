import { hasAdminPassword, isAdminAuthenticated } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return <LoginForm passwordEnabled={hasAdminPassword()} />;
}
