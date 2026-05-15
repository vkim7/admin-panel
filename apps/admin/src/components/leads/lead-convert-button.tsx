import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LeadConvertButton({
  leadId,
  size = "default",
  fullWidth = true,
}: {
  leadId: string;
  size?: "default" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Button asChild size={size} className={fullWidth ? "w-full" : undefined}>
      <Link href={`/students/new?leadId=${leadId}&returnTo=/leads`}>
        Convert to student
      </Link>
    </Button>
  );
}
