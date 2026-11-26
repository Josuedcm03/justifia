"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { ActiveToggle } from "@/app/(dashboard)/catalog/active-toggle";

import { setDocenteActivoAction, updateDocenteAction } from "./actions";
import { DocenteForm } from "./docente-form";

// The pages are Server Components that never import a Server Action (guarded by
// `guards.test.ts`), so the two controls below bind each action to its
// component on the client side of the boundary.

type FormProps = Omit<ComponentProps<typeof DocenteForm>, "action">;

/**
 * The edit form bound to `updateDocenteAction`. It is keyed by the docente's
 * state: a refused edit of a docente that turned out to be inactive locks the
 * form, and without a new key the lock would outlive the reactivation that
 * follows. No page can forget it, because the key lives here.
 */
export function EditDocenteForm(props: FormProps) {
  return (
    <DocenteForm
      key={String(props.record.activo)}
      {...props}
      action={updateDocenteAction}
    />
  );
}

type ToggleProps = {
  id: number;
  nombreCompleto: string;
  correo: string | null;
  activo: boolean;
  /** Active grupos of the docente, as the page read them (DM-8). */
  gruposActivos: number;
};

/**
 * The activate/deactivate control of a docente. It composes the confirmation
 * (DM-7): the docente's name with the email in parentheses to tell homonyms
 * apart, the sentence that grupos and remissions are kept, and the number of
 * active grupos. The toggle knows which intent it sent, so a request that
 * changed nothing says "already active" or "already inactive" (DM-16).
 */
export function DocenteActiveToggle({
  id,
  nombreCompleto,
  correo,
  activo,
  gruposActivos,
}: ToggleProps) {
  const t = useTranslations("catalog.docentes.state");

  return (
    <ActiveToggle
      action={setDocenteActivoAction}
      id={id}
      recordLabel={correo ? `${nombreCompleto} (${correo})` : nombreCompleto}
      activo={activo}
      notice={
        activo
          ? `${t("kept")} ${t("activeGroups", { count: gruposActivos })}`
          : undefined
      }
      unchangedText={{
        deactivate: t("alreadyInactive"),
        reactivate: t("alreadyActive"),
      }}
    />
  );
}
