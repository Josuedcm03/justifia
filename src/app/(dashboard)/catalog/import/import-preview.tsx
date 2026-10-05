"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";

import type {
  ApplyState,
  PreviewState,
} from "@/app/(dashboard)/catalog/import/actions";
import { CredentialsDownload } from "@/app/(dashboard)/catalog/import/credentials-download";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import type { EntityCounts, EntityName } from "@/lib/import/types";

type PreviewArm = Extract<PreviewState, { kind: "preview" }>;
type AppliedArm = Extract<ApplyState, { kind: "applied" }>;

const ENTITIES: readonly EntityName[] = ["Asignatura", "Usuario", "Grupo"];
const COUNT_KEYS = [
  "create",
  "update",
  "unchanged",
  "deactivate",
  "error",
] as const satisfies readonly (keyof EntityCounts)[];

function CountsTable({
  counts,
  caption,
}: {
  counts: Record<EntityName, EntityCounts>;
  caption: string;
}) {
  const t = useTranslations("catalog.import");
  const columns: readonly DataTableColumn<EntityName>[] = [
    {
      key: "entity",
      header: t("preview.columns.entity"),
      cell: (entity) => t(`entities.${entity}`),
      className: "font-medium",
    },
    ...COUNT_KEYS.map((key): DataTableColumn<EntityName> => ({
      key,
      header: t(`preview.columns.${key}`),
      cell: (entity) => counts[entity][key],
      align: "end",
    })),
  ];

  return (
    <DataTable
      columns={columns}
      rows={ENTITIES}
      getRowKey={(entity) => entity}
      caption={caption}
      empty={null}
    />
  );
}

/**
 * The dry-run report plus, only when the plan is clean, the confirm form. The
 * confirm form carries the digest of the previewed bytes; the caller re-attaches
 * the same file. Nothing here has been written: the copy says so.
 */
export function ImportPreview({
  state,
  fileName,
  action,
  pending,
  headingRef,
}: {
  state: PreviewArm;
  fileName: string;
  action: (formData: FormData) => void;
  pending: boolean;
  /** Lets the caller move focus here when a new preview arrives. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations("catalog.import");
  const hasErrors = state.errors.length > 0;

  return (
    <section
      aria-labelledby="import-preview-title"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h2
          ref={headingRef}
          id="import-preview-title"
          tabIndex={-1}
          // Clears the 64px sticky header when scrolled into view.
          className="text-headline focus-visible:ring-ring scroll-mt-20 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {t("preview.title")}
        </h2>
        <p className="text-muted-foreground max-w-prose">
          {t("preview.notSaved")}
        </p>
        {fileName ? (
          <p className="text-muted-foreground text-sm">
            {t("preview.file", { name: fileName })}
          </p>
        ) : null}
      </div>

      <CountsTable counts={state.counts} caption={t("preview.countsCaption")} />

      <div className="flex flex-col gap-2">
        <p className="font-medium">
          {t("preview.accountsToCreate", { count: state.accountsToCreate })}
        </p>
        {state.accountsToCreate > 0 ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("preview.accountsCost")}
          </p>
        ) : null}
        <p className="font-medium">
          {t("preview.deactivations", {
            count: state.counts.Grupo.deactivate,
          })}
        </p>
      </div>

      {/* With errors there is nothing to confirm: `ImportErrors`, above this
          section, lists them and says what to do. */}
      {hasErrors ? null : (
        <form action={action} className="flex flex-col items-start gap-4">
          <input type="hidden" name="fileSha256" value={state.fileSha256} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t("preview.confirming") : t("preview.confirm")}
          </Button>
        </form>
      )}
    </section>
  );
}

/** The applied summary and the one-shot credentials export. */
export function ImportResult({ state }: { state: AppliedArm }) {
  const t = useTranslations("catalog.import");
  const { summary, credentials } = state;

  return (
    <section
      aria-labelledby="import-result-title"
      className="flex flex-col gap-6"
    >
      <h2 id="import-result-title" className="text-headline">
        {t("result.title")}
      </h2>

      <CountsTable
        counts={summary.counts}
        caption={t("result.countsCaption")}
      />

      <div className="flex flex-col gap-2">
        <p className="font-medium">
          {t("result.accountsCreated", { count: summary.accountsCreated })}
        </p>
        <p className="font-medium">
          {t("result.accountsUpdated", { count: summary.accountsUpdated })}
        </p>
      </div>

      <CredentialsDownload credentials={credentials} />
    </section>
  );
}
