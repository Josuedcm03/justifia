"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_NEW_ACCOUNTS_PER_APPLY,
} from "@/lib/import/limits";
import type { RowError } from "@/lib/import/types";

function ErrorsTable({ errors }: { errors: readonly RowError[] }) {
  const t = useTranslations("catalog.import");
  // A reason the catalog does not know (e.g. a default validator message)
  // falls back to the raw code rather than to a missing-message marker.
  const reasonText = (error: RowError) =>
    t.has(`reasons.${error.reason}`)
      ? t(`reasons.${error.reason}`, {
          maxAccounts: MAX_NEW_ACCOUNTS_PER_APPLY,
          maxEvents: MAX_ACCOUNT_EVENTS_PER_APPLY,
          // The offending token, for the reasons that name it (`dias.invalid`).
          value: error.value ?? "",
        })
      : error.reason;
  const columns: readonly DataTableColumn<RowError>[] = [
    {
      key: "sheet",
      header: t("errorsPanel.columns.sheet"),
      cell: (error) => error.sheet,
      className: "font-medium",
    },
    {
      key: "row",
      header: t("errorsPanel.columns.row"),
      // Workbook-wide errors (the caps) have no row.
      cell: (error) => (error.row > 0 ? error.row : "—"),
      align: "end",
    },
    {
      key: "reason",
      header: t("errorsPanel.columns.reason"),
      cell: (error) => reasonText(error),
    },
    {
      key: "value",
      header: t("errorsPanel.columns.value"),
      cell: (error) => error.value ?? "",
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={errors}
      getRowKey={(error) =>
        `${error.sheet}|${error.row}|${error.reason}|${error.value ?? ""}`
      }
      caption={t("errorsPanel.caption")}
      empty={null}
    />
  );
}

/**
 * What is wrong with the analysed workbook, shown above the dry-run report so
 * it is the first thing read after a bad upload. The words carry the meaning
 * (how many errors, what to do next); the destructive tint only supports them.
 */
export function ImportErrors({
  errors,
  headingRef,
}: {
  errors: readonly RowError[];
  /** Lets the caller move focus here when a preview arrives with errors. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations("catalog.import.errorsPanel");

  return (
    <section
      aria-labelledby="import-errors-title"
      className="border-destructive/30 bg-destructive/8 flex flex-col gap-6 rounded-xl border p-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2
          ref={headingRef}
          id="import-errors-title"
          tabIndex={-1}
          // Read together with the instruction when focus lands here.
          aria-describedby="import-errors-help"
          // Clears the 64px sticky header when scrolled into view.
          className="text-headline focus-visible:ring-ring scroll-mt-20 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t("title", { count: errors.length })}
        </h2>
        <p id="import-errors-help" className="max-w-prose">
          {t("help")}
        </p>
      </div>

      {/* A plain surface under the rows, so they read as a table and not as
          tinted text. */}
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <ErrorsTable errors={errors} />
      </div>
    </section>
  );
}
