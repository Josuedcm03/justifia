import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type RankingRow = {
  key: string;
  label: string;
  /** Muted second line, e.g. the CIF that tells two students apart. */
  secondary?: string;
  /** The count, already written for the reader ("3 requests"). */
  totalText: string;
};

/**
 * One ranking of the coordination dashboard (CR-RANK-3, CR-DASH-1). Hook-free
 * and presentational: the container resolves every string, so the card never
 * sees a data-layer row, a request id or a cause. An empty ranking says so in
 * the same card instead of drawing an empty list.
 */
export function RankingCard({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: readonly RankingRow[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          <ol
            aria-label={title}
            className="divide-border flex flex-col divide-y"
          >
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="text-muted-foreground w-6 shrink-0 text-sm tabular-nums"
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium break-words">{row.label}</span>
                  {row.secondary ? (
                    <span className="text-muted-foreground text-xs">
                      {row.secondary}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {row.totalText}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
