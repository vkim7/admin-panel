import { Users, GraduationCap, Monitor, Smartphone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

interface FeaturesProps {
  dict: Dictionary["features"];
}

const iconMap = {
  Users,
  GraduationCap,
  Monitor,
  Smartphone,
} as const;

export function Features({ dict }: FeaturesProps) {
  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
          {dict.tag}
        </div>

        <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-4 max-w-[600px]">
          {dict.heading}
        </h2>

        <p className="text-[17px] text-foreground/60 max-w-[520px] mb-12 leading-relaxed">
          {dict.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dict.items.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            return (
              <div
                key={item.title}
                className="bg-white border-2 border-border rounded-xl p-8 shadow-shadow transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
              >
                <div className="w-12 h-12 bg-main border-2 border-border rounded-base flex items-center justify-center mb-5 shadow-[2px_2px_0_var(--border)]">
                  {Icon ? <Icon size={22} strokeWidth={2.5} /> : null}
                </div>
                <h3 className="font-heading font-bold text-[19px] mb-2 tracking-[-0.3px]">
                  {item.title}
                </h3>
                <p className="text-foreground/60 text-[15px] leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
