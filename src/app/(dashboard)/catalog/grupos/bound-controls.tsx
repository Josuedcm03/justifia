"use client";

import type { ComponentProps } from "react";

import { ActiveToggle } from "@/app/(dashboard)/catalog/active-toggle";

import {
  createGrupoAction,
  setGrupoActivoAction,
  updateGrupoAction,
} from "./actions";
import { GrupoForm } from "./grupo-form";

// The pages are Server Components that never import a Server Action (guarded by
// `guards.test.ts`), so the three controls below bind each action to its
// component on the client side of the boundary. Each one only fixes `action`;
// everything else comes from the page.

type FormProps = Omit<ComponentProps<typeof GrupoForm>, "action">;
type ToggleProps = Omit<ComponentProps<typeof ActiveToggle>, "action">;

// Create always has its Asignatura (fixed by the route); edit never takes one
// because the record carries its own.
export function CreateGrupoForm(
  props: Omit<FormProps, "record" | "asignatura"> & {
    asignatura: NonNullable<FormProps["asignatura"]>;
  },
) {
  return <GrupoForm {...props} action={createGrupoAction} />;
}

export function EditGrupoForm(
  props: Omit<FormProps, "asignatura"> & {
    record: NonNullable<FormProps["record"]>;
  },
) {
  return <GrupoForm {...props} action={updateGrupoAction} />;
}

export function GrupoActiveToggle(props: ToggleProps) {
  return <ActiveToggle {...props} action={setGrupoActivoAction} />;
}
