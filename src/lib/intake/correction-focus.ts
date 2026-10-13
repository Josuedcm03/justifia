import type { ReturnReason } from "./return-reasons";

/**
 * The step a correction opens at for each RN-17 return reason (SR-17): the
 * fix a document reason asks for is a new document, the fix a date reason
 * asks for is the registered date. The record is closed over the RN-17 list,
 * so adding a code fails typecheck until it is mapped. The reason only guides
 * the first step; it never locks a step or a field.
 */
export const CORRECTION_FOCUS: Readonly<
  Record<ReturnReason, "details" | "documents">
> = {
  documento_ilegible: "documents",
  fecha_alterada: "documents",
  fecha_incorrecta: "details",
};
