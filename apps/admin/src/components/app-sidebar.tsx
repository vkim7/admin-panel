"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/lib/actions/auth";
import {
  CalendarDays,
  UserPlus,
  CreditCard,
  GraduationCap,
  Users,
  Layers,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Reception", href: "/reception", icon: UserPlus },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Groups", href: "/groups", icon: Layers },
  { label: "Teachers", href: "/teachers", icon: Users },
];

export function AppSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => logout());
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/40 p-4">
      <div className="mb-6 px-2 text-lg font-semibold tracking-tight">
        Eng Admin
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t pt-3">
        <div className="px-3 text-xs text-muted-foreground">{adminName}</div>
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <LogOut className="size-3.5" />
          {isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
