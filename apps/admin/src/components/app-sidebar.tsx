"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logout } from "@/lib/actions/auth";
import type { LucideIcon } from "lucide-react";
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
  Receipt,
  ReceiptText,
  Tag,
  UserX,
  Loader2,
  BookOpen,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Daily Workflow",
    items: [
      { label: "Schedule", href: "/schedule", icon: CalendarDays },
      { label: "Reception", href: "/reception", icon: UserPlus },
      { label: "Reassignment", href: "/reassignment", icon: RefreshCw },
      { label: "Uncertain", href: "/uncertain", icon: AlertTriangle },
      { label: "Lost", href: "/lost", icon: UserX },
      { label: "Substitutions", href: "/pending-lessons", icon: AlertCircle },
    ],
  },
  {
    title: "Students & Groups",
    items: [
      { label: "Students", href: "/students", icon: GraduationCap },
      { label: "Groups", href: "/groups", icon: Layers },
      { label: "Exams", href: "/exams", icon: BookOpen },
    ],
  },
  {
    title: "Teachers",
    items: [
      { label: "Teachers", href: "/teachers", icon: Users },
      { label: "Teacher Pay", href: "/teacher-payments", icon: Banknote },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "No Payment", href: "/payments", icon: CreditCard },
      { label: "Payment History", href: "/payment-history", icon: Receipt },
      { label: "Refunds", href: "/refunds", icon: ReceiptText },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Promotions", href: "/promotions", icon: Tag },
    ],
  },
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

const badgeConfig: Record<string, keyof Omit<AppSidebarProps, "adminName">> = {
  "/reception": "receptionCount",
  "/reassignment": "reassignmentCount",
  "/uncertain": "uncertainCount",
  "/pending-lessons": "pendingResolutionCount",
  "/refunds": "pendingRefundCount",
  "/lost": "lostCount",
};

export function AppSidebar({
  adminName,
  receptionCount,
  reassignmentCount,
  uncertainCount,
  pendingResolutionCount,
  pendingRefundCount,
  lostCount,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavPending, startNavTransition] = useTransition();
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const counts: AppSidebarProps = {
    adminName,
    receptionCount,
    reassignmentCount,
    uncertainCount,
    pendingResolutionCount,
    pendingRefundCount,
    lostCount,
  };

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
    <aside className="bg-muted/40 sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r p-4">
      <Link
        href="/schedule"
        className="mb-6 block px-2 text-lg font-semibold tracking-tight"
      >
        Admin Panel
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {navSections.map((section, sectionIdx) => (
          <div key={section.title} className={sectionIdx > 0 ? "mt-4" : ""}>
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              const isPending = resolvedPending === item.href;
              const Icon = item.icon;
              const badgeKey = badgeConfig[item.href];
              const badgeCount = badgeKey
                ? (counts[badgeKey] as number | undefined)
                : undefined;

              return (
                <button
                  key={item.href}
                  onClick={() => handleNav(item.href)}
                  disabled={isNavPending}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
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
                  {badgeCount ? (
                    <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">
                      {badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t pt-3">
        <div className="text-muted-foreground px-3 text-xs">{adminName}</div>
        <button
          onClick={handleLogout}
          disabled={isLogoutPending}
          className="text-muted-foreground hover:bg-muted mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm disabled:opacity-50"
        >
          <LogOut className="size-3.5" />
          {isLogoutPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
