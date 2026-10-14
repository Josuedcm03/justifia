"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "cn";

import { TableHead } from "@/components/ui/table";
import type { SortDir } from "@/lib/list-params";

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;
const STATE_KEY = {
  asc: "ascending",
  desc: "descending",
  none: "sortable",
} as const;

/**
 * The header cell of a sortable column (DT-SORT-2): a native button inside the
 * `th`, named by the column label, 44px tall inside the unchanged 48px header
 * row (DT-DENS-1). Its inline padding gives the focus ring room and the equal
 * negative margin keeps the label aligned with the cell text below it.
 *
 * `aria-sort` is set only while this column is the sorted one. The state is
 * drawn as three different icons, the only visual indicator, and exposed as
 * the button's description, so it never relies on colour alone. The accessible
 * name stays exactly the column label and assistive technology reads the state
 * from `aria-sort` and the description. Nothing here animates.
 */
export function SortableHeader({
  children,
  direction,
  onSort,
  align = "start",
  className,
}: {
  /** The column label; it is the button's accessible name. */
  children: ReactNode;
  /** The sort of this column, or `false` when another column is sorted. */
  direction: SortDir | false;
  onSort: () => void;
  align?: "start" | "end";
  className?: string;
}) {
  const t = useTranslations("tables");
  const state = direction === false ? "none" : direction;
  const Icon =
    state === "asc" ? ArrowUp : state === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <TableHead
      scope="col"
      aria-sort={direction === false ? undefined : ARIA_SORT[direction]}
      className={cn(align === "end" && "text-right", className)}
    >
      <button
        type="button"
        onClick={onSort}
        title={t(`sort.${STATE_KEY[state]}`)}
        className={cn(
          "text-label-caps -mx-3 inline-flex min-h-11 items-center gap-x-2 rounded-lg px-3 uppercase",
          "hover:text-foreground outline-none",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        )}
      >
        {children}
        <Icon
          aria-hidden="true"
          className={cn("size-4 shrink-0", state === "none" && "opacity-60")}
        />
      </button>
    </TableHead>
  );
}
