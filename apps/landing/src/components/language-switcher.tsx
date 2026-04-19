import Link from "next/link";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const languages = [
    { code: "uz", label: "UZ" },
    { code: "ru", label: "RU" },
  ] as const;

  return (
    <div className="flex border-2 border-border rounded-full overflow-hidden">
      {languages.map((lang) => (
        <Link
          key={lang.code}
          href={`/${lang.code}`}
          className={cn(
            "px-3 py-1.5 text-xs font-bold transition-all",
            currentLocale === lang.code
              ? "bg-foreground text-white"
              : "bg-white text-foreground/60 hover:bg-background",
          )}
        >
          {lang.label}
        </Link>
      ))}
    </div>
  );
}
