import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

type TableCardProps = Omit<ComponentProps<"div">, "children"> & {
  children: ReactNode;
  /** Search, filters and count; omitted entirely when not passed. */
  toolbar?: ReactNode;
  /** Pagination; omitted entirely when not passed. */
  footer?: ReactNode;
  /** New rows are loading: the card is busy and the rows dim. */
  pending?: boolean;
};

/**
 * The list card (docs/design-system.md section 5, "Table card"): the frame
 * drawn once, with optional toolbar and footer regions divided by hairlines.
 * Hook-free, so a server page and a client table can both use it.
 *
 * While `pending` the card is `aria-busy` and the rows dim by opacity over
 * 150ms, the only property that moves (BS-MOT-1). The toolbar and footer stay
 * at full strength and enabled, because navigation is interruptible
 * (DT-PEND-1).
 */
export function TableCard({
  children,
  toolbar,
  footer,
  pending = false,
  className,
  ...props
}: TableCardProps) {
  return (
    <div
      data-slot="table-card"
      aria-busy={pending ? true : undefined}
      className={cn(
        "border-border bg-card shadow-soft overflow-hidden rounded-xl border",
        className,
      )}
      {...props}
    >
      {toolbar ? (
        <div
          data-slot="table-card-toolbar"
          className="border-border border-b px-6 py-4"
        >
          {toolbar}
        </div>
      ) : null}
      <div
        data-slot="table-card-body"
        className={cn(
          "transition-opacity duration-150",
          pending && "opacity-60",
        )}
      >
        {children}
      </div>
      {footer ? (
        <div
          data-slot="table-card-footer"
          className="border-border border-t px-6 py-4"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
