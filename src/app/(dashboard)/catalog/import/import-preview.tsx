"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, type Ref } from "react";

import type {
  ApplyState,
  PreviewState,
} from "@/app/(dashboard)/catalog/import/actions";
import { CredentialsDownload } from "@/app/(dashboard)/catalog/import/credentials-download";
import { DataTable } from "@/components/tables/data-table";
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

/**
 * The counts as a fixed matrix (DT-MODE-1): one row per entity, one column per
 * outcome, in bounded mode, so it has no sort control, paging or toolbar.
 */
function CountsTable({
  counts,
  caption,
}: {
  counts: Record<EntityName, EntityCounts>;
  caption: string;
}) {
  const t = useTranslations("catalog.import");
  const columns = useMemo<ColumnDef<EntityName>[]>(
    () => [
      {
        id: "entity",
        header: t("preview.columns.entity"),
        cell: ({ row }) => t(`entities.${row.original}`),
        meta: { className: "font-medium" },
      },
      ...COUNT_KEYS.map((key): ColumnDef<EntityName> => ({
        id: key,
        header: t(`preview.columns.${key}`),
        cell: ({ row }) => counts[row.original][key],
        meta: { align: "end" },
      })),
    ],
    [t, counts],
  );

  return (
    <DataTable
      columns={columns}
      rows={ENTITIES}
      getRowId={(entity) => entity}
      caption={caption}
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
  busy = false,
}: {
  state: PreviewArm;
  fileName: string;
  action: (formData: FormData) => void;
  pending: boolean;
  /** Lets the caller move focus here when a new preview arrives. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** The last confirm found the catalog busy: nothing was applied. */
  busy?: boolean;
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
        {state.asignaturasToReactivate > 0 ? (
          <p className="font-medium">
            {t("preview.reactivations", {
              count: state.asignaturasToReactivate,
            })}
          </p>
        ) : null}
        {state.manualGruposToDeactivate > 0 ? (
          <p className="border-warning/30 bg-warning/10 text-warning-ink max-w-prose rounded-xl border p-4 font-medium">
            {t("preview.manualGroups", {
              count: state.manualGruposToDeactivate,
            })}
          </p>
        ) : null}
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("preview.replacedEdits")}
        </p>
      </div>

      {busy ? (
        <p
          role="alert"
          className="border-warning/30 bg-warning/10 text-warning-ink max-w-prose rounded-xl border p-4 font-medium"
        >
          {t("preview.busy")}
        </p>
      ) : null}

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
        <p className="font-medium">
          {t("result.asignaturasReactivated", {
            count: summary.asignaturasReactivated,
          })}
        </p>
        <p className="font-medium">
          {t("result.manualGruposDeactivated", {
            count: summary.manualGruposDeactivated,
          })}
        </p>
      </div>

      <CredentialsDownload credentials={credentials} />
    </section>
  );
}
