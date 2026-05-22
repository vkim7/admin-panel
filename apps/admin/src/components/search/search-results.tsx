import Link from "next/link";
import { formatUzPhone } from "@/lib/helpers/phone-format";
import {
  getLeadLocation,
  getStudentLocation,
  type PipelineLocation,
} from "@/lib/helpers/pipeline-location";
import type { SearchHit } from "@/lib/queries/search";

function StatusBadge({ location }: { location: PipelineLocation }) {
  return (
    <Link
      href={location.href}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold hover:underline ${location.color}`}
    >
      {location.label}
    </Link>
  );
}

export function SearchResults({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No matches.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((hit) => {
            if (hit.kind === "student") {
              const location = getStudentLocation(hit);
              return (
                <tr key={`s-${hit.id}`} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Student
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/students/${hit.id}`}
                      className="font-medium hover:underline"
                    >
                      {hit.firstName} {hit.lastName}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      #{hit.crmCode}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`tel:${hit.phone}`}
                      className="text-primary hover:underline"
                    >
                      {formatUzPhone(hit.phone)}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge location={location} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {hit.linkedLead && (
                      <span>
                        from Lead{" "}
                        <Link href="/leads" className="hover:underline">
                          ({hit.linkedLead.status.toLowerCase()})
                        </Link>
                      </span>
                    )}
                  </td>
                </tr>
              );
            }

            const location = getLeadLocation(hit);
            return (
              <tr key={`l-${hit.id}`} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Lead
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link href="/leads" className="font-medium hover:underline">
                    {hit.firstName} {hit.lastName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`tel:${hit.phone}`}
                    className="text-primary hover:underline"
                  >
                    {formatUzPhone(hit.phone)}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge location={location} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
