"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Causa } from "@/lib/intake/causes";
import type { CauseSetting } from "@/lib/parameters/registry";

import { DeactivateCauseDialog } from "./deactivate-cause-dialog";
import {
  ParameterSection,
  SaveOutcome,
  useParameterForm,
  type ParameterFormAction,
} from "./parameter-form";

type Row = { codigo: Causa; activa: boolean };

/**
 * The five causes of RN-01 (NP-11), in the stored order: an active box and the
 * move buttons for each. The codes are fixed, so there is no control to add,
 * rename or delete one. The order on screen is the position that is saved. A
 * save that unchecks an active cause asks first in the confirmation dialog
 * (NP-8); every other save is submitted at once.
 */
export function CausesSection({
  action,
  causes,
}: {
  action: ParameterFormAction;
  causes: readonly CauseSetting[];
}) {
  const t = useTranslations("parameters.causes");
  const ts = useTranslations("parameters.actions");
  const names = useTranslations("intake.causes");
  const { state, pending, fieldErrors, submit } = useParameterForm(action);
  const [rows, setRows] = useState<Row[]>(() =>
    causes.map(({ codigo, activa }) => ({ codigo, activa })),
  );
  // The causes whose deactivation waits for the answer of the dialog.
  const [asking, setAsking] = useState<readonly Causa[]>([]);
  const saveRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  // After a cancel the dialog is gone: focus goes back to the save button.
  useEffect(() => {
    if (asking.length === 0 && restoreFocus.current) {
      restoreFocus.current = false;
      saveRef.current?.focus();
    }
  }, [asking]);

  // The whole list in one field, as the action reads it: the order on screen
  // is the position.
  function send() {
    const data = new FormData();
    data.set(
      "causas",
      JSON.stringify(
        rows.map(({ codigo, activa }, index) => ({
          codigo,
          activa,
          posicion: index + 1,
        })),
      ),
    );
    submit(data);
  }

  function move(index: number, by: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  function save() {
    const deactivated = causes
      .filter(
        ({ codigo, activa }) =>
          activa && !rows.find((row) => row.codigo === codigo)?.activa,
      )
      .map(({ codigo }) => codigo);
    if (deactivated.length > 0) {
      setAsking(deactivated);
    } else {
      send();
    }
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
          save();
        }}
      >
        <ol className="flex flex-col">
          {rows.map((row, index) => (
            <li
              key={row.codigo}
              className="border-border flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0"
            >
              <label className="text-foreground inline-flex min-h-11 items-center gap-2 text-sm select-none">
                <Checkbox
                  checked={row.activa}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((other) =>
                        other.codigo === row.codigo
                          ? { ...other, activa: event.target.checked }
                          : other,
                      ),
                    )
                  }
                />
                {names(row.codigo)}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label={t("moveUp", { cause: names(row.codigo) })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label={t("moveDown", { cause: names(row.codigo) })}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>

        {fieldErrors.causas ? (
          <p role="alert" className="text-destructive-ink text-sm">
            {fieldErrors.causas}
          </p>
        ) : null}
        <SaveOutcome state={state} pending={pending} />
        <div>
          <Button ref={saveRef} type="submit" size="lg" disabled={pending}>
            {pending ? ts("saving") : ts("save")}
          </Button>
        </div>
      </form>

      <DeactivateCauseDialog
        names={asking.map((codigo) => names(codigo))}
        onConfirm={() => {
          setAsking([]);
          send();
        }}
        onCancel={() => {
          restoreFocus.current = true;
          setAsking([]);
        }}
      />
    </ParameterSection>
  );
}
