"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/lib/actions/auth";

const navItems = [
  { label: "Schedule", href: "/schedule" },
  { label: "Reception", href: "/reception" },
  { label: "Payments", href: "/payments" },
  { label: "Students", href: "/students" },
  { label: "Teachers", href: "/teachers" },
];

export function AppSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => logout());
  }

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/40 p-4">
      <div className="mb-6 px-2 text-lg font-semibold">Admin</div>
      <nav className="flex flex-1 flex-col gap-1">
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
      <div className="border-t pt-3">
        <div className="px-3 text-xs text-muted-foreground">{adminName}</div>
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="mt-1 w-full rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
