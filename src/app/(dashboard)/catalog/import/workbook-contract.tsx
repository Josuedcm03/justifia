import { cn } from "cn";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { type SheetContract, SHEETS } from "@/lib/import/sheets";

const TEMPLATE_PATH = "/api/catalog/template";
const RULES = [
  "noId",
  "carreraExists",
  "horasPositive",
  "periodoFormat",
  "correoDocenteResolves",
  "diasTokens",
  "diasEffect",
] as const;

const CELL =
  "border-border bg-muted border-l px-3 py-2 text-left align-top text-sm whitespace-nowrap first:border-l-0";

/**
 * Row 1 of one sheet, drawn as the spreadsheet header it is. A real one-row
 * table so the column names are announced as column headers; the wrapper
 * scrolls sideways (and is focusable, so the keyboard can scroll it) instead
 * of letting a wide sheet break the card.
 */
function HeaderStrip({ sheet }: { sheet: SheetContract }) {
  const t = useTranslations("catalog.import.contract");
  const caption = t("columnsCaption", { sheet: sheet.name });

  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="border-border focus-visible:border-ring focus-visible:ring-ring/50 overflow-x-auto rounded-lg border outline-none focus-visible:ring-3"
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {sheet.required.map((column) => (
              <th
                key={column}
                scope="col"
                className={`${CELL} text-foreground font-semibold`}
              >
                <span className="block">{column}</span>
              </th>
            ))}
            {/* Optional is said in words, not by the muted colour alone. */}
            {sheet.optional.map((column) => (
              <th
                key={column}
                scope="col"
                className={`${CELL} text-muted-foreground font-normal`}
              >
                {/* The space keeps the accessible name two words. */}
                <span className="block">{column}</span>{" "}
                <span className="text-label block">{t("optional")}</span>
              </th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );
}

/**
 * The workbook contract, as static copy from `SHEETS` (never derived from an
 * upload): every sheet's header row at once, the rules and the template.
 * `children` close the card, after the rules: the caller puts the file picker
 * there, so the contract is always read (and announced) before it.
 */
export function WorkbookContract({ children }: { children?: ReactNode }) {
  const t = useTranslations("catalog.import.contract");

  return (
    <section
      aria-labelledby="import-contract-title"
      className="border-border bg-card shadow-soft flex flex-col gap-6 rounded-xl border p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <h2 id="import-contract-title" className="text-headline">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose">{t("intro")}</p>
        </div>
        <a
          href={TEMPLATE_PATH}
          // The soft accent pair, not the primary outline: both tokens are redefined
          // per theme, so the tint holds in light and dark with no `dark:`
          // override. The hover deepens it toward its own foreground.
          className={cn(
            buttonVariants({ variant: null, size: "lg" }),
            "bg-accent text-accent-foreground hover:bg-[color-mix(in_oklch,var(--accent),var(--accent-foreground)_12%)]",
          )}
        >
          {t("template")}
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <ol className="flex flex-col gap-4">
          {SHEETS.map((sheet) => (
            <li key={sheet.name} className="flex flex-col gap-2">
              <h3 className="text-title">{sheet.name}</h3>
              <HeaderStrip sheet={sheet} />
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("legend")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-title">{t("rulesTitle")}</h3>
        <ul className="flex list-disc flex-col gap-1 pl-6 text-sm">
          {RULES.map((rule) => (
            <li key={rule}>{t(`rules.${rule}`)}</li>
          ))}
        </ul>
      </div>

      {children}
    </section>
  );
}
