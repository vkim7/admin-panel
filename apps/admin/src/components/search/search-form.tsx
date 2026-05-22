import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Native GET form — Next.js handles the navigation on submit; no JS needed.
// Keeps this route server-only and bookmarkable.
export function SearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  return (
    <form action="/search" method="get" className="flex gap-2">
      <Input
        name="q"
        type="search"
        inputMode="tel"
        autoComplete="off"
        autoFocus
        defaultValue={defaultQuery}
        placeholder="Phone (e.g. +998 50 111 22 33 or 501112233)"
        className="max-w-sm"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
