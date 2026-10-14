import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type StateLink = { href: string; label: string };

type EmptyStateProps =
  | {
      /** Nothing exists yet: one sentence and, optionally, the create action. */
      variant: "empty";
      message: string;
      action?: StateLink;
    }
  | {
      /** A search or filter matched nothing: the clear link is required. */
      variant: "no-results";
      title: string;
      hint: string;
      clear: StateLink;
    };

/**
 * The shared empty and no-results states (BS-STATE-1, docs/design-system.md
 * section 5). Both are text, never colour alone. Hook-free: the copy arrives as
 * props, so a server page and a client table can use it. Whether a table or this
 * component shows is decided by the list as a whole, so a table with no rows is
 * never rendered.
 */
export function EmptyState(props: EmptyStateProps) {
  if (props.variant === "empty") {
    return (
      <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
        <p className="text-muted-foreground max-w-prose">{props.message}</p>
        {props.action ? (
          <Link href={props.action.href} className={buttonVariants()}>
            {props.action.label}
          </Link>
        ) : null}
      </div>
    );
  }

  // The type already forbids a missing clear link; this keeps a JavaScript
  // caller or a bad cast from shipping a dead end.
  if (!props.clear?.href) {
    throw new Error("EmptyState no-results requires a clear link");
  }

  return (
    <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
      <p className="text-foreground max-w-prose font-medium">{props.title}</p>
      <p className="text-muted-foreground max-w-prose">{props.hint}</p>
      <Link
        href={props.clear.href}
        className={buttonVariants({ variant: "outline" })}
      >
        {props.clear.label}
      </Link>
    </div>
  );
}
