"use client";

import { useTranslations } from "next-intl";
import { useId, type FormEvent } from "react";

import { useListNavigation } from "@/components/tables/list-navigation";
import { StatusFilter } from "@/components/tables/status-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseQ, type StatusFilterValue } from "@/lib/list-params";

/** The cap every list applies to `q` (the data-table URL contract). */
const SEARCH_MAX = 100;

type TableToolbarProps = {
  /** The term in the URL; the field follows it. */
  q: string;
  /** Visible label and name of the search landmark, e.g. "Search users". */
  searchLabel: string;
  searchPlaceholder?: string;
  /**
   * Target of the plain GET form and the fields that carry the other
   * parameters. They only matter for a submit before hydration; with
   * JavaScript the submit goes through `hrefFor` (design decision 6).
   */
  action: string;
  hidden?: Readonly<Record<string, string>>;
  /** The href for a submitted term: page 1, everything else kept. */
  hrefFor: (q: string) => string;
  /** Result count of the current view. */
  total: number;
  /** The status filter, for the lists that define one. */
  status?: {
    selected: StatusFilterValue;
    hrefFor: (value: StatusFilterValue) => string;
  };
};

/**
 * Search, status filter and result count (DT-TOOL-1). Search is applied only
 * on submit (D5): typing alone changes nothing. A submit is a history `push`
 * through the shared list transition, and the href comes from the caller's
 * builder, never from here (N5).
 *
 * The count is a polite status region. While a navigation is pending it reads
 * the localized "updating" text until the new count replaces it
 * (DT-PEND-1); the region never moves focus.
 */
export function TableToolbar({
  q,
  searchLabel,
  searchPlaceholder,
  action,
  hidden = {},
  hrefFor,
  total,
  status,
}: TableToolbarProps) {
  const t = useTranslations("tables");
  const { navigate, pending } = useListNavigation();
  const inputId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get("q");
    const term = parseQ(typeof raw === "string" ? raw : undefined, SEARCH_MAX);
    navigate(hrefFor(term), "push");
  }

  return (
    <div
      role="group"
      aria-label={t("toolbar.label")}
      className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3"
    >
      <form
        method="get"
        action={action}
        role="search"
        aria-label={searchLabel}
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-2"
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{searchLabel}</Label>
          {/* Uncontrolled and keyed by the URL term, so it follows a new
              term (clear, back button) without a state mirror. */}
          <Input
            key={q}
            id={inputId}
            name="q"
            type="search"
            defaultValue={q}
            placeholder={searchPlaceholder}
            maxLength={SEARCH_MAX}
            className="h-11"
          />
        </div>
        <Button type="submit" size="lg">
          {t("search.submit")}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {status ? (
          <StatusFilter selected={status.selected} hrefFor={status.hrefFor} />
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-sm"
        >
          {pending ? t("updating") : t("count", { count: total })}
        </p>
      </div>
    </div>
  );
}
