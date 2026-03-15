import { AppSidebar } from "@/components/app-sidebar";
import { requireAdmin } from "@/lib/auth";
import { getReceptionCount } from "@/lib/queries/reception";
import { getUncertainCount } from "@/lib/queries/students";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // This will redirect to /login if not authenticated
  const [admin, receptionCount, uncertainCount] = await Promise.all([
    requireAdmin(),
    getReceptionCount(),
    getUncertainCount(),
  ]);

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        adminName={`${admin.firstName} ${admin.lastName}`}
        receptionCount={receptionCount}
        uncertainCount={uncertainCount}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
