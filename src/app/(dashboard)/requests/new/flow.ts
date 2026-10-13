import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";

// What the intake steps need from the flow that hosts them (SR-13): where its
// pages live and which actions it calls. The new-request flow is the default of
// every step; the correction flow (`/requests/[id]/correct`) passes its own, so
// the same four step components serve both without knowing which one they are in.

type FlowActions = {
  saveDetails: (input: unknown) => Promise<ActionResult>;
  saveSubjects: (input: unknown) => Promise<ActionResult>;
  finalizeDocument: (
    input: unknown,
  ) => Promise<ActionResult & { documentId?: number }>;
  removeDocument: (documentId: unknown) => Promise<ActionResult>;
  resubmit: () => Promise<ActionResult>;
};

export type StepFlow<K extends keyof FlowActions> = {
  basePath: string;
  actions: Pick<FlowActions, K>;
};

export type Flow = StepFlow<keyof FlowActions>;
