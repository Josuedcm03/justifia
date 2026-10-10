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

export function CreateGrupoForm(props: Omit<FormProps, "record">) {
  return <GrupoForm {...props} action={createGrupoAction} />;
}

export function EditGrupoForm(
  props: FormProps & { record: NonNullable<FormProps["record"]> },
) {
  return <GrupoForm {...props} action={updateGrupoAction} />;
}

export function GrupoActiveToggle(props: ToggleProps) {
  return <ActiveToggle {...props} action={setGrupoActivoAction} />;
}
