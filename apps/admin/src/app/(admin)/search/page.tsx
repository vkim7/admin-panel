import { PageHeader } from "@/components/ui/page-header";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { searchByPhone } from "@/lib/queries/search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const hits = query ? await searchByPhone(query) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Search" breadcrumbs={[{ label: "Search" }]} />
      <SearchForm defaultQuery={query} />

      {hits === null ? (
        <div className="rounded-md border">
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Enter a phone number (or partial — at least 3 digits) to search.
          </div>
        </div>
      ) : (
        <SearchResults hits={hits} />
      )}
    </div>
  );
}
