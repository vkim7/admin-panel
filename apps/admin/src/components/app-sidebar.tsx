"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logout } from "@/lib/actions/auth";
import {
  CalendarDays,
  UserPlus,
  CreditCard,
  GraduationCap,
  Users,
  Layers,
  LogOut,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Banknote,
  ReceiptText,
  Tag,
  UserX,
  Loader2,
} from "lucide-react";

const navItems = [
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Reception", href: "/reception", icon: UserPlus },
  { label: "Reassignment", href: "/reassignment", icon: RefreshCw },
  { label: "Uncertain", href: "/uncertain", icon: AlertTriangle },
  { label: "Pending", href: "/pending-lessons", icon: AlertCircle },
  { label: "No Payment", href: "/payments", icon: CreditCard },
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Groups", href: "/groups", icon: Layers },
  { label: "Teachers", href: "/teachers", icon: Users },
  { label: "Teacher Pay", href: "/teacher-payments", icon: Banknote },
  { label: "Refunds", href: "/refunds", icon: ReceiptText },
  { label: "Promotions", href: "/promotions", icon: Tag },
  { label: "Lost", href: "/lost", icon: UserX },
];

interface AppSidebarProps {
  adminName: string;
  receptionCount?: number;
  reassignmentCount?: number;
  uncertainCount?: number;
  pendingResolutionCount?: number;
  pendingRefundCount?: number;
  lostCount?: number;
}

export function AppSidebar({ adminName, receptionCount, reassignmentCount, uncertainCount, pendingResolutionCount, pendingRefundCount, lostCount }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavPending, startNavTransition] = useTransition();
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function handleNav(href: string) {
    setPendingHref(href);
    startNavTransition(() => {
      router.push(href);
    });
  }

  // Clear pending state once navigation completes (pathname changes)
  const resolvedPending = isNavPending ? pendingHref : null;

  function handleLogout() {
    startLogoutTransition(() => logout());
  }

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-muted/40 p-4">
      <Link href="/schedule" className="mb-6 block px-2 text-lg font-semibold tracking-tight">
        Eng Admin
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const isPending = resolvedPending === item.href;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              disabled={isNavPending}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isPending
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              {item.label}
              {item.href === "/reception" && receptionCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {receptionCount}
                </span>
              ) : null}
              {item.href === "/reassignment" && reassignmentCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {reassignmentCount}
                </span>
              ) : null}
              {item.href === "/uncertain" && uncertainCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {uncertainCount}
                </span>
              ) : null}
              {item.href === "/pending-lessons" && pendingResolutionCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {pendingResolutionCount}
                </span>
              ) : null}
              {item.href === "/refunds" && pendingRefundCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {pendingRefundCount}
                </span>
              ) : null}
              {item.href === "/lost" && lostCount ? (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {lostCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="border-t pt-3">
        <div className="px-3 text-xs text-muted-foreground">{adminName}</div>
        <button
          onClick={handleLogout}
          disabled={isLogoutPending}
          className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <LogOut className="size-3.5" />
          {isLogoutPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
