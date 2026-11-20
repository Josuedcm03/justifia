import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";
import {
  ISSUER_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from "@/lib/document-data/validation";
import type { ExtractionRowView } from "@/lib/extraction/display";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/app/(dashboard)/review/[id]/document-data-actions", () => ({
  saveDocumentDataAction: actionMock,
}));

import { DocumentDataForm } from "@/app/(dashboard)/review/[id]/document-data-form";

// manual-document-data: MD-23 (the form), MD-24 (no revalidation, no
// confirmation), MD-25 (i18n). The form is a client component that receives
// the values of one document and sends one FormData to the server action; it
// shows the refusals the action returns, keeping what was typed.

const en = messages.en.review.extraction;
const es = messages.es.review.extraction;

type Props = ComponentProps<typeof DocumentDataForm>;

const NO_MARKS = { type: null, hasSignature: null, hasSeal: null } as const;

const EXTRACTED: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Central",
  issueDate: "2026-07-18",
  restFrom: "2026-07-20",
  restTo: "2026-07-24",
  restDays: 5,
};

function show(props: Partial<Props> = {}, locale: "en" | "es" = "en") {
  return renderIntl(
    <DocumentDataForm
      solicitudId={12}
      documentoId={31}
      documentName="constancia.pdf"
      manual={null}
      marks={NO_MARKS}
      extracted={null}
      {...props}
    />,
    locale,
  );
}

async function openForm(locale: "en" | "es" = "en") {
  const copy = locale === "en" ? en : es;
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: copy.form.open }));
  return {
    user,
    form: await screen.findByRole("form", {
      name: copy.form.formLabel.replace("{name}", "constancia.pdf"),
    }),
  };
}

const sent = () => actionMock.mock.calls[0][0] as FormData;

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue({ ok: false, reason: "unexpected" });
});

describe("DocumentDataForm fields (MD-23, RF-14 a, b, d)", () => {
  it("is closed until the secretary opens it, with no field and no confirmation", async () => {
    show();

    expect(screen.getByRole("button", { name: en.form.open })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

    await openForm();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("offers text for the name and the issuer, dates for the issue and the rest, and no days input", async () => {
    show();
    const { form } = await openForm();

    expect(
      within(form).getByRole("textbox", { name: en.form.fields.studentName }),
    ).toBeInTheDocument();
    expect(
      within(form).getByRole("textbox", { name: en.fields.issuer }),
    ).toBeInTheDocument();
    for (const label of [
      en.fields.issueDate,
      en.form.fields.restFrom,
      en.form.fields.restTo,
    ]) {
      expect(within(form).getByLabelText(label)).toHaveAttribute(
        "type",
        "date",
      );
    }
    // The days are derived, never entered (MD-3).
    expect(within(form).queryByRole("spinbutton")).toBeNull();
    expect(within(form).queryByLabelText(/days/i)).toBeNull();
    expect(within(form).getAllByRole("textbox")).toHaveLength(2);
  });

  it("limits the name and the issuer to the lengths the validation allows", async () => {
    show();
    const { form } = await openForm();

    expect(
      within(form).getByRole("textbox", { name: en.form.fields.studentName }),
    ).toHaveAttribute("maxlength", String(NAME_MAX_LENGTH));
    expect(
      within(form).getByRole("textbox", { name: en.fields.issuer }),
    ).toHaveAttribute("maxlength", String(ISSUER_MAX_LENGTH));
    expect([NAME_MAX_LENGTH, ISSUER_MAX_LENGTH]).toEqual([160, 200]);
  });

  it("offers the type with 'Not registered' and the three types", async () => {
    show();
    const { user, form } = await openForm();

    await user.click(
      within(form).getByRole("combobox", { name: en.marks.type }),
    );
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      en.markValues.unregistered,
      en.types.constancia_medica,
      en.types.constancia_institucional,
      en.types.otro,
    ]);
  });

  it.each([en.marks.signature, en.marks.seal])(
    "offers %s as Yes, No and Not registered, with 'Not registered' chosen by default",
    async (label) => {
      show();
      const { form } = await openForm();

      const group = within(form).getByRole("radiogroup", { name: label });
      const radios = within(group).getAllByRole("radio");

      expect(
        within(group).getByRole("radio", { name: en.markValues.yes }),
      ).not.toBeChecked();
      expect(
        within(group).getByRole("radio", { name: en.markValues.no }),
      ).not.toBeChecked();
      expect(
        within(group).getByRole("radio", { name: en.markValues.unregistered }),
      ).toBeChecked();
      expect(radios).toHaveLength(3);
    },
  );

  it("is prefilled only with the manual values, and shows the extracted value beside the field", async () => {
    show({
      extracted: EXTRACTED,
      manual: {
        studentName: null,
        issuer: "Clinica Santa Fe",
        issueDate: null,
        restFrom: null,
        restTo: null,
      },
    });
    const { form } = await openForm();

    const name = within(form).getByRole("textbox", {
      name: en.form.fields.studentName,
    });
    const issuer = within(form).getByRole("textbox", {
      name: en.fields.issuer,
    });
    expect(issuer).toHaveValue("Clinica Santa Fe");
    // The extracted value is a reference and is not prefilled as manual.
    expect(name).toHaveValue("");
    expect(within(form).getByLabelText(en.fields.issueDate)).toHaveValue("");
    expect(within(form).getByLabelText(en.form.fields.restFrom)).toHaveValue(
      "",
    );
    expect(within(form).getByLabelText(en.form.fields.restTo)).toHaveValue("");
    expect(name).toHaveAccessibleDescription(
      en.form.ocrHint.replace("{value}", "Ana Lopez"),
    );
    expect(issuer).toHaveAccessibleDescription(
      en.form.ocrHint.replace("{value}", "Clinica Central"),
    );
    expect(
      within(form).getByLabelText(en.fields.issueDate),
    ).toHaveAccessibleDescription(
      en.form.ocrHint.replace("{value}", "Jul 18, 2026"),
    );
    expect(
      within(form).getByRole("group", { name: en.fields.restPeriod }),
    ).toHaveAccessibleDescription(
      en.form.ocrHint.replace(
        "{value}",
        "Jul 20, 2026 to Jul 24, 2026 (5 days)",
      ),
    );
  });

  it("prefills nothing when the document has no manual record, whatever was extracted", async () => {
    show({ extracted: EXTRACTED, manual: null });
    const { form } = await openForm();

    for (const box of within(form).getAllByRole("textbox")) {
      expect(box).toHaveValue("");
    }
    for (const label of [
      en.fields.issueDate,
      en.form.fields.restFrom,
      en.form.fields.restTo,
    ]) {
      expect(within(form).getByLabelText(label)).toHaveValue("");
    }
  });

  it("shows no reference for a value the extraction did not read, or a row that is not completed", async () => {
    show({
      extracted: {
        ...EXTRACTED,
        issuer: null,
        restFrom: null,
        restTo: null,
        restDays: null,
      },
    });
    const { form, user } = await openForm();

    expect(
      within(form).getByRole("textbox", { name: en.fields.issuer }),
    ).not.toHaveAccessibleDescription(/Extracted value/);
    expect(
      within(form).getByRole("group", { name: en.fields.restPeriod }),
    ).not.toHaveAccessibleDescription(/Extracted value/);
    await user.keyboard("{Escape}");
  });

  it("does not show a reference from a failed extraction", async () => {
    show({ extracted: { ...EXTRACTED, state: "fallida" } });
    const { form } = await openForm();

    expect(form).not.toHaveTextContent(/Extracted value/);
  });

  it("shows the registered marks and type, and a rest range typed as two dates", async () => {
    show({
      marks: {
        type: "constancia_institucional",
        hasSignature: true,
        hasSeal: false,
      },
      manual: {
        studentName: "Ana Lopez",
        issuer: null,
        issueDate: "2026-07-18",
        restFrom: "2026-07-20",
        restTo: "2026-07-24",
      },
    });
    const { form } = await openForm();

    expect(
      within(
        within(form).getByRole("radiogroup", { name: en.marks.signature }),
      ).getByRole("radio", { name: en.markValues.yes }),
    ).toBeChecked();
    expect(
      within(
        within(form).getByRole("radiogroup", { name: en.marks.seal }),
      ).getByRole("radio", { name: en.markValues.no }),
    ).toBeChecked();
    expect(
      within(form).getByRole("combobox", { name: en.marks.type }),
    ).toHaveTextContent(en.types.constancia_institucional);
    expect(within(form).getByLabelText(en.form.fields.restFrom)).toHaveValue(
      "2026-07-20",
    );
    expect(within(form).getByLabelText(en.form.fields.restTo)).toHaveValue(
      "2026-07-24",
    );
    expect(within(form).getByLabelText(en.fields.issueDate)).toHaveValue(
      "2026-07-18",
    );
  });

  it("speaks Spanish", async () => {
    show({}, "es");
    const { form } = await openForm("es");

    expect(
      within(form).getByRole("textbox", { name: es.form.fields.studentName }),
    ).toBeInTheDocument();
    expect(
      within(
        within(form).getByRole("radiogroup", { name: es.marks.signature }),
      ).getByRole("radio", { name: "Sin registrar" }),
    ).toBeChecked();
    expect(
      within(form).getByRole("button", { name: es.form.save }),
    ).toBeInTheDocument();
  });
});

describe("DocumentDataForm submit (MD-23, MD-24)", () => {
  it("sends the whole form of the document as one FormData, with no dialog", async () => {
    show();
    const { user, form } = await openForm();

    await user.type(
      within(form).getByRole("textbox", { name: en.form.fields.studentName }),
      "Ana Lopez",
    );
    await user.type(
      within(form).getByRole("textbox", { name: en.fields.issuer }),
      "Clinica Santa Fe",
    );
    await user.type(
      within(form).getByLabelText(en.fields.issueDate),
      "2026-11-02",
    );
    await user.type(
      within(form).getByLabelText(en.form.fields.restFrom),
      "2026-11-03",
    );
    await user.type(
      within(form).getByLabelText(en.form.fields.restTo),
      "2026-11-05",
    );
    await user.click(
      within(form).getByRole("combobox", { name: en.marks.type }),
    );
    await user.click(
      await screen.findByRole("option", { name: en.types.constancia_medica }),
    );
    await user.click(
      within(
        within(form).getByRole("radiogroup", { name: en.marks.signature }),
      ).getByRole("radio", { name: en.markValues.yes }),
    );
    await user.click(
      within(
        within(form).getByRole("radiogroup", { name: en.marks.seal }),
      ).getByRole("radio", { name: en.markValues.no }),
    );
    expect(actionMock).not.toHaveBeenCalled();
    await user.click(within(form).getByRole("button", { name: en.form.save }));

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(sent().entries())).toEqual({
      solicitudId: "12",
      documentoId: "31",
      studentName: "Ana Lopez",
      issuer: "Clinica Santa Fe",
      issueDate: "2026-11-02",
      restFrom: "2026-11-03",
      restTo: "2026-11-05",
      type: "constancia_medica",
      hasSignature: "yes",
      hasSeal: "no",
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends 'unregistered' for the untouched marks and the type, and empty text", async () => {
    show();
    const { user, form } = await openForm();

    await user.click(within(form).getByRole("button", { name: en.form.save }));

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(sent().entries())).toEqual({
      solicitudId: "12",
      documentoId: "31",
      studentName: "",
      issuer: "",
      issueDate: "",
      restFrom: "",
      restTo: "",
      type: "unregistered",
      hasSignature: "unregistered",
      hasSeal: "unregistered",
    });
  });

  it("sends the registered values back when nothing is touched", async () => {
    show({
      marks: { type: "otro", hasSignature: false, hasSeal: true },
      manual: {
        studentName: null,
        issuer: "Clinica Santa Fe",
        issueDate: null,
        restFrom: null,
        restTo: null,
      },
    });
    const { user, form } = await openForm();

    await user.click(within(form).getByRole("button", { name: en.form.save }));

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(sent().get("issuer")).toBe("Clinica Santa Fe");
    expect(sent().get("type")).toBe("otro");
    expect(sent().get("hasSignature")).toBe("no");
    expect(sent().get("hasSeal")).toBe("yes");
  });

  it("shows the saving state and ignores a second submit while the first runs", async () => {
    let finish: (value: unknown) => void = () => {};
    actionMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    show();
    const { user, form } = await openForm();

    await user.click(within(form).getByRole("button", { name: en.form.save }));

    const saving = await within(form).findByRole("button", {
      name: en.form.saving,
    });
    expect(saving).toBeDisabled();
    await user.click(saving);
    // Enter in a field submits the form without the button.
    fireEvent.submit(form);
    expect(actionMock).toHaveBeenCalledTimes(1);

    finish({ ok: false, reason: "unexpected" });
    expect(
      await within(form).findByRole("button", { name: en.form.save }),
    ).toBeEnabled();
    // A second action queued behind the first would run once it settled.
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("is never submitted without the secretary pressing save", async () => {
    show();
    await openForm();

    expect(actionMock).not.toHaveBeenCalled();
  });
});

describe("DocumentDataForm refusals (MD-23: a refusal keeps the input)", () => {
  it("shows an error on each invalid field, links it to the control and keeps what was typed", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: {
        studentName: "text_too_long",
        issueDate: "date_invalid",
        rest: "rest_order",
        type: "type_invalid",
        hasSignature: "mark_invalid",
      },
    });
    show();
    const { user, form } = await openForm();
    const name = within(form).getByRole("textbox", {
      name: en.form.fields.studentName,
    });
    await user.type(name, "Ana Lopez");
    await user.type(
      within(form).getByLabelText(en.form.fields.restFrom),
      "2026-11-09",
    );
    await user.type(
      within(form).getByLabelText(en.form.fields.restTo),
      "2026-11-08",
    );

    await user.click(within(form).getByRole("button", { name: en.form.save }));

    expect(
      await within(form).findByText(en.form.errors.text_too_long),
    ).toBeVisible();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(en.form.errors.text_too_long);
    expect(within(form).getByLabelText(en.fields.issueDate)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(form).getByText(en.form.errors.date_invalid)).toBeVisible();
    expect(within(form).getByText(en.form.errors.rest_order)).toBeVisible();
    expect(within(form).getByText(en.form.errors.type_invalid)).toBeVisible();
    expect(within(form).getByText(en.form.errors.mark_invalid)).toBeVisible();
    expect(within(form).getAllByRole("alert").length).toBeGreaterThanOrEqual(5);
    // What was typed is still there, in the same open form.
    expect(name).toHaveValue("Ana Lopez");
    expect(within(form).getByLabelText(en.form.fields.restFrom)).toHaveValue(
      "2026-11-09",
    );
    expect(within(form).getByLabelText(en.form.fields.restTo)).toHaveValue(
      "2026-11-08",
    );
  });

  it("shows the rest error once, under the rest period", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: { rest: "rest_incomplete" },
    });
    show();
    const { user, form } = await openForm();

    await user.click(within(form).getByRole("button", { name: en.form.save }));

    const group = within(form).getByRole("group", {
      name: en.fields.restPeriod,
    });
    expect(
      await within(group).findAllByText(en.form.errors.rest_incomplete),
    ).toHaveLength(1);
    expect(group).toHaveAccessibleDescription(en.form.errors.rest_incomplete);
    expect(within(form).queryByText(en.form.errors.text_too_long)).toBeNull();
  });

  it.each(["not_found", "not_editable", "unexpected"] as const)(
    "shows the failure %s as an alert and keeps the form open and filled",
    async (reason) => {
      actionMock.mockResolvedValue({ ok: false, reason });
      show();
      const { user, form } = await openForm();
      const issuer = within(form).getByRole("textbox", {
        name: en.fields.issuer,
      });
      await user.type(issuer, "Clinica Santa Fe");

      await user.click(
        within(form).getByRole("button", { name: en.form.save }),
      );

      expect(await within(form).findByRole("alert")).toHaveTextContent(
        en.form.failures[reason],
      );
      expect(issuer).toHaveValue("Clinica Santa Fe");
    },
  );

  it("clears the last refusal when it is submitted again", async () => {
    actionMock.mockResolvedValueOnce({ ok: false, reason: "unexpected" });
    show();
    const { user, form } = await openForm();

    await user.click(within(form).getByRole("button", { name: en.form.save }));
    expect(await within(form).findByRole("alert")).toBeVisible();

    let finish: (value: unknown) => void = () => {};
    actionMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await user.click(within(form).getByRole("button", { name: en.form.save }));
    await waitFor(() => expect(within(form).queryByRole("alert")).toBeNull());
    finish({ ok: false, reason: "unexpected" });
  });

  it("words the refusals in Spanish, with the formal register", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: { issueDate: "date_invalid" },
    });
    show({}, "es");
    const { user, form } = await openForm("es");

    await user.click(within(form).getByRole("button", { name: es.form.save }));

    expect(
      await within(form).findByText("Indique una fecha válida."),
    ).toBeVisible();
  });
});

describe("DocumentDataForm layout and structure (MD-24, 360 px)", () => {
  it("is one column at 360 px, with wrapping radios and a full-width button", async () => {
    show();
    const { form } = await openForm();

    expect(form.querySelector(".grid.gap-4.sm\\:grid-cols-2")).not.toBeNull();
    for (const label of [en.marks.signature, en.marks.seal]) {
      expect(within(form).getByRole("radiogroup", { name: label })).toHaveClass(
        "flex",
        "flex-wrap",
        "gap-2",
      );
    }
    expect(
      within(form).getByRole("button", { name: en.form.save }),
    ).toHaveClass("w-full", "sm:w-auto");
    const classes = [...form.querySelectorAll("[class]")].flatMap((el) =>
      el.className.toString().split(/\s+/),
    );
    expect(classes.filter((c) => /^(min-|max-)?w-(\[|[1-9])/.test(c))).toEqual(
      [],
    );
  });

  it("never revalidates or refreshes, and links nowhere", async () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/review/[id]/document-data-form.tsx",
      ),
      "utf8",
    );

    expect(source).not.toMatch(
      /revalidatePath|revalidateTag|updateTag|router\.refresh|refresh\(\)|useRouter|<Link/,
    );
    show();
    await openForm();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("reports no accessibility violation, open and with refusals", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: { studentName: "text_too_long", rest: "rest_order" },
    });
    const { container } = show({ extracted: EXTRACTED });
    const { user, form } = await openForm();
    await user.click(within(form).getByRole("button", { name: en.form.save }));
    await within(form).findByText(en.form.errors.text_too_long);

    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});
