import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.adminId) redirect("/schedule");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Google account
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
