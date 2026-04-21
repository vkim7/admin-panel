import type { Dictionary } from "@/lib/i18n";

interface StatsProps {
  dict: Dictionary["stats"];
}

const stats = [
  { value: "8–12", key: "maxGroup" as const },
  { value: "80", key: "minLesson" as const },
  { value: "3×", key: "perWeek" as const },
  { value: "Oxford", key: "curriculum" as const },
];

export function Stats({ dict }: StatsProps) {
  return (
    <div className="border-y-2 border-border bg-foreground text-white">
      <div className="max-w-[1080px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.key}
            className={`text-center py-9 px-4 ${
              i > 0 ? "md:border-l md:border-[#333]" : ""
            } ${
              /* Mobile: right border on odd items, bottom border on first row */
              i % 2 === 0 ? "border-r border-[#333] md:border-r-0" : ""
            } ${i < 2 ? "border-b border-[#333] md:border-b-0" : ""}`}
          >
            <div className="font-heading font-black text-4xl text-main leading-none mb-1">
              {stat.value}
            </div>
            <div className="text-[13px] font-semibold text-[#999]">
              {dict[stat.key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
