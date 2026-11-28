"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { TableCard } from "@/components/table-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NonWorkingDay } from "@/lib/parameters/registry";

import {
  ParameterSection,
  SaveOutcome,
  useParameterForm,
  type ParameterFormAction,
} from "./parameter-form";

type Row = { id: number; fecha: string; descripcion: string; removed: boolean };

/** What an input needs to be tied to its error text. */
function errorProps(errorId: string, message: string | undefined) {
  return message
    ? { "aria-invalid": true as const, "aria-describedby": errorId }
    : {};
}

/**
 * The calendar of non-business days (NP-10) as one editable list: add a row
 * with a date and an optional description, mark a row removed, save the whole
 * list in one press. A removed row stays on screen until the save so it can be
 * restored; it is simply left out of the list that is sent. The action keys a
 * row error by its place in that list, so the rows still listed are counted.
 */
export function CalendarSection({
  action,
  entries,
}: {
  action: ParameterFormAction;
  entries: readonly NonWorkingDay[];
}) {
  const t = useTranslations("parameters.calendar");
  const ts = useTranslations("parameters.actions");
  const { state, pending, fieldErrors, submit } = useParameterForm(action);
  const idBase = useId();
  const nextId = useRef(entries.length);
  const [rows, setRows] = useState<Row[]>(() =>
    entries.map((entry, id) => ({
      id,
      fecha: entry.fecha,
      descripcion: entry.descripcion ?? "",
      removed: false,
    })),
  );

  const listed = rows.filter((row) => !row.removed);
  const value = JSON.stringify(
    listed.map(({ fecha, descripcion }) => ({ fecha, descripcion })),
  );

  function update(id: number, change: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change } : row)),
    );
  }

  return (
    <ParameterSection title={t("title")} description={t("description")}>
      <form
        method="post"
        noValidate
        className="flex flex-col gap-5"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="calendario" value={value} />

        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dateColumn")}</TableHead>
                <TableHead>{t("descriptionColumn")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actionsColumn")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((row, index) => {
                const place = row.removed ? -1 : listed.indexOf(row);
                const dateError = fieldErrors[`fecha.${place}`];
                const descriptionError = fieldErrors[`descripcion.${place}`];
                const number = index + 1;
                const dateErrorId = `${idBase}-fecha-${row.id}`;
                const descriptionErrorId = `${idBase}-descripcion-${row.id}`;

                if (row.removed) {
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="line-through">
                        {row.fecha}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t("removed")}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={t("restoreRow", { row: number })}
                          onClick={() => update(row.id, { removed: false })}
                        >
                          {t("restore")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={row.id}>
                    <TableCell className="align-top">
                      <Input
                        type="date"
                        aria-label={t("dateLabel", { row: number })}
                        value={row.fecha}
                        onChange={(event) =>
                          update(row.id, { fecha: event.target.value })
                        }
                        {...errorProps(dateErrorId, dateError)}
                      />
                      {dateError ? (
                        <p
                          id={dateErrorId}
                          role="alert"
                          className="text-destructive-ink mt-1 text-sm"
                        >
                          {dateError}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        aria-label={t("descriptionLabel", { row: number })}
                        autoComplete="off"
                        value={row.descripcion}
                        onChange={(event) =>
                          update(row.id, { descripcion: event.target.value })
                        }
                        {...errorProps(descriptionErrorId, descriptionError)}
                      />
                      {descriptionError ? (
                        <p
                          id={descriptionErrorId}
                          role="alert"
                          className="text-destructive-ink mt-1 text-sm"
                        >
                          {descriptionError}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={t("removeRow", { row: number })}
                        onClick={() => update(row.id, { removed: true })}
                      >
                        {t("remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const id = nextId.current++;
              setRows((current) => [
                ...current,
                { id, fecha: "", descripcion: "", removed: false },
              ]);
            }}
          >
            {t("add")}
          </Button>
        </div>

        {fieldErrors.calendario ? (
          <p role="alert" className="text-destructive-ink text-sm">
            {fieldErrors.calendario}
          </p>
        ) : null}
        <SaveOutcome state={state} pending={pending} />
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? ts("saving") : ts("save")}
          </Button>
        </div>
      </form>
    </ParameterSection>
  );
}
