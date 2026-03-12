import { AppSidebar } from "@/components/app-sidebar";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // This will redirect to /login if not authenticated
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <AppSidebar adminName={`${admin.firstName} ${admin.lastName}`} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
