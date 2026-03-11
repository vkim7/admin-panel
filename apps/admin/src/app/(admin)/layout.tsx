import { AppSidebar } from "@/components/app-sidebar";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
