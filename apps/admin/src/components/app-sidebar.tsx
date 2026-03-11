"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Schedule", href: "/schedule" },
  { label: "Reception", href: "/reception" },
  { label: "Payments", href: "/payments" },
  { label: "Students", href: "/students" },
  { label: "Teachers", href: "/teachers" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/40 p-4">
      <div className="mb-6 px-2 text-lg font-semibold">Admin</div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
