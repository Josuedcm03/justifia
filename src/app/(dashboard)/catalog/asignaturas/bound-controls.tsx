"use client";

import type { ComponentProps } from "react";

import { ActiveToggle } from "@/app/(dashboard)/catalog/active-toggle";

import {
  createAsignaturaAction,
  setAsignaturaActivoAction,
  updateAsignaturaAction,
} from "./actions";
import { AsignaturaForm } from "./asignatura-form";

// The pages are Server Components that never import a Server Action (guarded by
// `guards.test.ts`), so the three controls below bind each action to its
// component on the client side of the boundary. Each one only fixes `action`;
// everything else comes from the page.

type FormProps = Omit<ComponentProps<typeof AsignaturaForm>, "action">;
type ToggleProps = Omit<ComponentProps<typeof ActiveToggle>, "action">;

export function CreateAsignaturaForm(props: Omit<FormProps, "record">) {
  return <AsignaturaForm {...props} action={createAsignaturaAction} />;
}

export function EditAsignaturaForm(
  props: FormProps & { record: NonNullable<FormProps["record"]> },
) {
  return <AsignaturaForm {...props} action={updateAsignaturaAction} />;
}

export function AsignaturaActiveToggle(props: ToggleProps) {
  return <ActiveToggle {...props} action={setAsignaturaActivoAction} />;
}
