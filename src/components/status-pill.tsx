export function StatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={
        active
          ? "bg-success/10 text-success-ink inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          : "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      }
    >
      {label}
    </span>
  );
}
