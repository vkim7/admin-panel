import { Button } from "@/components/ui/button";

export default function SchedulePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Main Schedule</h1>
      <div className="flex gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </div>
  );
}
