"use client";

import { useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  applyAction,
  type ApplyState,
  previewAction,
} from "@/app/(dashboard)/catalog/import/actions";
import {
  type DropzonePhase,
  FileDropzone,
} from "@/app/(dashboard)/catalog/import/file-dropzone";
import { ImportErrors } from "@/app/(dashboard)/catalog/import/import-errors";
import {
  ImportPreview,
  ImportResult,
} from "@/app/(dashboard)/catalog/import/import-preview";
import { WorkbookContract } from "@/app/(dashboard)/catalog/import/workbook-contract";
import { MAX_FILE_BYTES } from "@/lib/import/limits";

const IDLE = { kind: "idle" } as const;

type FlowRequest = { intent: "preview" | "apply"; formData: FormData };

type PreviewArm = Extract<ApplyState, { kind: "preview" }>;
/** Client-side only. A busy answer keeps the preview it came from, so the
 *  screen stays and the confirm control remains available for a retry. */
type FlowState =
  Exclude<ApplyState, { kind: "busy" }> | { kind: "busy"; preview: PreviewArm };

/**
 * One reducer for both steps. The previous state is deliberately NOT forwarded
 * to the server: after an apply it holds the temporary credentials, which must
 * never travel back in a request.
 */
async function runFlow(
  previous: FlowState,
  { intent, formData }: FlowRequest,
): Promise<FlowState> {
  if (intent === "preview") return previewAction(IDLE, formData);
  const next = await applyAction(IDLE, formData);
  if (next.kind !== "busy") return next;
  // Confirm only exists on a preview, so one is always at hand here.
  if (previous.kind === "preview") return { kind: "busy", preview: previous };
  return previous.kind === "busy" ? { ...previous } : IDLE;
}

/**
 * Immediate feedback only: the server runs its own guards on every upload and
 * stays the authority. Returns the `errors.*` key to show, if any.
 */
function precheck(file: File): "wrongExtension" | "tooLarge" | null {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "wrongExtension";
  if (file.size > MAX_FILE_BYTES) return "tooLarge";
  return null;
}

export function ImportForm() {
  const t = useTranslations("catalog.import");
  const [state, dispatch, isPending] = useActionState(runFlow, IDLE);
  // The confirm step re-uploads the very file that was previewed, so the File
  // is kept here; the file input itself is emptied after every pick.
  const [file, setFile] = useState<File | null>(null);
  // The on-the-spot check's message, kept apart from the server's state.
  const [localError, setLocalError] = useState<string | null>(null);
  // Which step the pending action belongs to: only a preview is "analysing".
  const [applying, setApplying] = useState(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const errorsHeading = useRef<HTMLHeadingElement>(null);

  // A new preview changes the screen below the fold: take the keyboard and the
  // screen reader there. A workbook with errors lands on the warning first,
  // a clean one on the report. Keyed on the state object, so it runs once per
  // answer from the server and never on an ordinary re-render.
  useEffect(() => {
    if (state.kind !== "preview") return;
    const heading =
      state.errors.length > 0 ? errorsHeading.current : previewHeading.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [state]);

  /** Taking a file (dropped or picked) is what runs the preview. */
  function takeFile(chosen: File) {
    if (isPending) return;
    const problem = precheck(chosen);
    setLocalError(problem ? t(`errors.${problem}`) : null);
    // A rejected file replaces nothing: a preview on screen keeps its own file.
    if (problem) return;

    const formData = new FormData();
    formData.set("file", chosen);
    setFile(chosen);
    setApplying(false);
    startTransition(() => dispatch({ intent: "preview", formData }));
  }

  function submitApply(formData: FormData) {
    if (file) formData.set("file", file);
    setApplying(true);
    dispatch({ intent: "apply", formData });
  }

  const analysing = isPending && !applying;
  const shown =
    state.kind === "busy"
      ? state.preview
      : state.kind === "preview"
        ? state
        : null;
  let phase: DropzonePhase = "idle";
  if (analysing) phase = "analysing";
  else if (shown || state.kind === "applied") {
    phase = "loaded";
  }
  // While a new answer is on its way, the previous failure no longer applies.
  const serverError =
    !isPending && state.kind === "error" ? state.message : null;
  const report = shown && !analysing ? shown : null;

  return (
    <div className="flex flex-col gap-8">
      {/* The picker closes the structure card: the contract comes first. */}
      <WorkbookContract>
        <FileDropzone
          phase={phase}
          file={file}
          disabled={isPending}
          error={localError ?? serverError}
          onFile={takeFile}
        />
      </WorkbookContract>

      {/* While another file is analysed, the report on screen would describe
          the previous one under the new file's name, so it steps aside. What
          has to be corrected comes before the counts. */}
      {report && report.errors.length > 0 ? (
        <ImportErrors errors={report.errors} headingRef={errorsHeading} />
      ) : null}
      {report ? (
        <ImportPreview
          state={report}
          fileName={file?.name ?? ""}
          action={submitApply}
          pending={isPending}
          headingRef={previewHeading}
          busy={state.kind === "busy" && !isPending}
        />
      ) : null}
      {state.kind === "applied" ? <ImportResult state={state} /> : null}
    </div>
  );
}
