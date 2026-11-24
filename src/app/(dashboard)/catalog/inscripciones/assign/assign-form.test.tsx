import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignForm } from "@/app/(dashboard)/catalog/inscripciones/assign/assign-form";
import type { AssignGroupsProps } from "@/app/(dashboard)/catalog/inscripciones/assign/assign-groups";
import type { AssignInscripcionState } from "@/lib/catalog/types";
import { renderWithIntl } from "@/test/intl";

// The staff assign form (EA-SIB-1, EA-CHG-1, EA-CRE-1, RNF-12, RNF-11): a choice
// of group, a confirm step that names what will change, and the answer of
// `assignInscripcionAction`. The action is a double: what it was called with is
// what the browser would have sent.

vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);
const { assignMock } = vi.hoisted(() => ({ assignMock: vi.fn() }));
vi.mock("@/app/(dashboard)/catalog/inscripciones/actions", () => ({
  assignInscripcionAction: assignMock,
}));

beforeEach(() => {
  assignMock.mockReset();
  assignMock.mockResolvedValue({
    kind: "done",
    outcome: "created",
    replaced: 0,
  });
});

type Group = AssignGroupsProps["groups"][number];

const group = (
  grupoId: number,
  numeroGrupo: string,
  current = false,
): Group => ({
  grupoId,
  numeroGrupo,
  docenteNombre: "Luis Gómez",
  dias: ["lunes"],
  current,
});

const NO_CURRENT: AssignGroupsProps = {
  student: { id: 11, nombreCompleto: "Ana Pérez", cif: "2021-0001" },
  asignatura: { id: 31, codigo: "MAT101", nombre: "Calculo I" },
  periodo: "2026-S2",
  groups: [group(21, "02"), group(22, "03"), group(23, "04")],
  currentGroup: null,
};
const CURRENT_OFFERED: AssignGroupsProps = {
  ...NO_CURRENT,
  groups: [group(21, "02", true), group(22, "03"), group(23, "04")],
  currentGroup: { grupoId: 21, numeroGrupo: "02" },
};
// The student's group is no longer offered: it is still the one replaced.
const CURRENT_NOT_OFFERED: AssignGroupsProps = {
  ...NO_CURRENT,
  groups: [group(22, "03"), group(23, "04")],
  currentGroup: { grupoId: 21, numeroGrupo: "02" },
};

const choose = (number: string) =>
  screen.getByRole("button", { name: `Assign group ${number} to Ana Pérez` });
const pressed = (name: string) => screen.getByRole("button", { name });

async function open(props: AssignGroupsProps, number: string) {
  const user = userEvent.setup();
  renderWithIntl(<AssignForm {...props} />, "en");
  await user.click(choose(number));
  return { user, dialog: await screen.findByRole("alertdialog") };
}

describe("AssignForm choice", () => {
  it("marks the current group and offers no way to submit it", () => {
    renderWithIntl(<AssignForm {...CURRENT_OFFERED} />, "en");

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Current group")).toBeInTheDocument();
    expect(within(items[0]).queryByRole("button")).toBeNull();
    expect(
      screen.getAllByRole("button").map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Assign group 03 to Ana Pérez", "Assign group 04 to Ana Pérez"]);
    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe("AssignForm confirm step (EA-SIB-1: names what changes)", () => {
  // The group named as replaced is the id sent as `expectedReplaced` (13.6).
  const ROWS: [string, AssignGroupsProps, string, string, number | null][] = [
    [
      "no group in the subject",
      NO_CURRENT,
      "03",
      "Ana Pérez will be enrolled in group 03 of MAT101 · Calculo I for 2026-S2.",
      null,
    ],
    [
      "a current group that is offered",
      CURRENT_OFFERED,
      "04",
      "Ana Pérez will be moved to group 04 of MAT101 · Calculo I for 2026-S2. This replaces group 02, which will be deactivated.",
      21,
    ],
    [
      "a current group that is no longer offered",
      CURRENT_NOT_OFFERED,
      "03",
      "Ana Pérez will be moved to group 03 of MAT101 · Calculo I for 2026-S2. This replaces group 02, which will be deactivated.",
      21,
    ],
  ];

  it.each(ROWS)(
    "with %s it names the change and sends once what it named",
    async (_name, props, number, sentence, expectedReplaced) => {
      const { user, dialog } = await open(props, number);

      expect(within(dialog).getByText(sentence)).toBeInTheDocument();
      expect(assignMock).not.toHaveBeenCalled();

      await user.click(pressed("Confirm"));

      await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
      const grupoId = props.groups.find(
        (g) => g.numeroGrupo === number,
      )!.grupoId;
      expect(assignMock).toHaveBeenCalledWith(11, grupoId, expectedReplaced);
    },
  );

  it("sends nothing when she cancels", async () => {
    const { user } = await open(CURRENT_OFFERED, "03");

    await user.click(pressed("Cancel"));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables the dialog and the choices while the action works, and sends once", async () => {
    let finish!: (state: AssignInscripcionState) => void;
    assignMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user } = await open(NO_CURRENT, "03");

    await user.click(pressed("Confirm"));

    const saving = await screen.findByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    expect(pressed("Cancel")).toBeDisabled();
    await user.click(saving);
    expect(assignMock).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    finish({ kind: "done", outcome: "created", replaced: 0 });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

describe("AssignForm answers", () => {
  const STALE =
    "The student's enrollment changed since you opened this page. Review it and try again.";
  const ROWS: [string, AssignInscripcionState, string, string][] = [
    [
      "created",
      { kind: "done", outcome: "created", replaced: 0 },
      "status",
      "Ana Pérez was enrolled in group 03.",
    ],
    [
      "reactivated and replaced",
      { kind: "done", outcome: "reactivated", replaced: 1 },
      "status",
      "Ana Pérez's enrollment in group 03 was reactivated. The previous group was deactivated.",
    ],
    ["stale", { kind: "error", message: STALE }, "alert", STALE],
    [
      "gone",
      { kind: "gone" },
      "alert",
      "This record is not available. It may not exist, or it may not be available to your account. Go back and check the list.",
    ],
  ];

  it.each(ROWS)(
    "renders %s and closes the dialog",
    async (_name, answer, role, text) => {
      assignMock.mockResolvedValue(answer);
      const { user } = await open(NO_CURRENT, "03");

      await user.click(pressed("Confirm"));

      const region = await screen.findByRole(role);
      expect(within(region).getByText(text)).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).toBeNull();
    },
  );

  it("links back to the list after a success and stops offering the groups", async () => {
    const { user } = await open(NO_CURRENT, "03");

    await user.click(pressed("Confirm"));

    const back = await screen.findByRole("link", { name: "Back to the list" });
    expect(back).toHaveAttribute("href", "/catalog/inscripciones");
    expect(back).toHaveAttribute("data-prefetch", "false");
    for (const number of ["02", "03", "04"]) {
      expect(choose(number)).toBeDisabled();
    }
  });

  it.each([
    ["stale", { kind: "error", message: STALE }],
    ["gone", { kind: "gone" }],
  ] as const)(
    "keeps the form usable after %s and offers a reload",
    async (_name, answer) => {
      assignMock.mockResolvedValue(answer);
      const { user } = await open(CURRENT_OFFERED, "03");
      await user.click(pressed("Confirm"));
      await screen.findByRole("alert");

      const reload = screen.getByRole("link", { name: "Reload this page" });
      expect(reload).toHaveAttribute(
        "href",
        "/catalog/inscripciones/assign?estudiante=11&asignatura=31",
      );
      expect(reload).toHaveAttribute("data-prefetch", "false");
      await user.click(choose("04"));
      expect(await screen.findByRole("alertdialog")).toHaveTextContent(
        "group 04",
      );
      expect(pressed("Confirm")).toBeEnabled();
    },
  );
});

// RNF-11: jsdom has no layout, so this is the static guard the other 360 px
// tests use. The real check is the owner walk.
describe("AssignForm touch targets and 360 px (RNF-11)", () => {
  const FIXED_WIDTH = /^(?:min-)?w-(?:\d+|\[\d+(?:\.\d+)?(?:px|rem)\])$/;

  function expectSmallScreenSafe() {
    const controls = [...document.body.querySelectorAll("button, a")];
    expect(controls.length).toBeGreaterThanOrEqual(3);
    for (const control of controls) expect(control).toHaveClass("h-11");
    const fixed = [...document.body.querySelectorAll("[class]")].flatMap((el) =>
      el.className
        .toString()
        .split(/\s+/)
        .filter((token) => FIXED_WIDTH.test(token)),
    );
    expect(fixed).toEqual([]);
  }

  it("gives every control 44 px, no fixed width, and wrapping text", async () => {
    assignMock.mockResolvedValue({ kind: "error", message: "Stale" });
    const { user, dialog } = await open(CURRENT_OFFERED, "03");

    expectSmallScreenSafe();
    expect(within(dialog).getByText(/^Ana Pérez will be moved/)).toHaveClass(
      "break-words",
    );
    expect(pressed("Confirm").parentElement).toHaveClass("flex-col-reverse");

    await user.click(pressed("Confirm"));
    await screen.findByRole("alert");

    expectSmallScreenSafe();
    expect(choose("04")).toHaveClass("w-full");
  });
});
