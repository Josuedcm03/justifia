"use client";

import { ListNavigationProvider } from "@/components/tables/list-navigation";
import { TableToolbar } from "@/components/tables/table-toolbar";
import { listHref } from "@/lib/list-params";

const BASE = "/review";

/**
 * The search of the staff queue. The href is built here, in the client,
 * because a function prop never crosses the server boundary.
 */
export function ReviewQueueSearch({
  q,
  total,
  label,
  placeholder,
}: {
  q: string;
  total: number;
  label: string;
  placeholder: string;
}) {
  return (
    <ListNavigationProvider>
      <TableToolbar
        q={q}
        searchLabel={label}
        searchPlaceholder={placeholder}
        action={BASE}
        hrefFor={(term) => listHref(BASE, { q: term })}
        total={total}
      />
    </ListNavigationProvider>
  );
}
