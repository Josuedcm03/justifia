import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function Example({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger>Discard</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard the draft?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialog", () => {
  it("stays closed until the trigger is pressed", async () => {
    render(<Example onConfirm={() => {}} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Discard the draft?");
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
  });

  it("cancel closes it without running the action", async () => {
    const onConfirm = vi.fn();
    render(<Example onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Keep it" }),
    );

    expect(onConfirm).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });

  it("the action runs its handler once", async () => {
    const onConfirm = vi.fn();
    render(<Example onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Yes, discard" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    render(<Example onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });
});
