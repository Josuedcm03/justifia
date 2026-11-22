import Link from "next/link";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USERS_SEARCH_MAX } from "@/lib/users/list-params";

import { ASSIGN_BASE, assignHref } from "./assign-params";

/** A student as the search shows them: the id of the link, the name and the
 *  CIF, nothing else (EA-PII-1). */
export type StudentOption = {
  id: number;
  nombreCompleto: string;
  cif: string | null;
};

/**
 * The student search (EA-CRE-1): one plain GET form, so the term lives in the
 * URL and a submit works before hydration. It carries no other parameter, so a
 * new search always starts from the bare page.
 */
export function StudentSearchForm({ q }: { q: string }) {
  const t = useTranslations("catalog.inscripciones.assign");

  return (
    <form
      method="get"
      action={ASSIGN_BASE}
      role="search"
      aria-label={t("search.form")}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-72">
        <Label htmlFor="assign-student-q">{t("search.label")}</Label>
        <Input
          id="assign-student-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search.placeholder")}
          maxLength={USERS_SEARCH_MAX}
          className="h-11"
        />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {t("search.submit")}
      </Button>
    </form>
  );
}

/**
 * The students a search found. Choosing one is a link, never a form: the page
 * audits every search (D10), so no link prefetches it. A search that matched
 * nobody is the shared no-results state with a link back to the bare page.
 */
export function StudentResults({
  q,
  students,
}: {
  q: string;
  students: readonly StudentOption[];
}) {
  const t = useTranslations("catalog.inscripciones.assign");

  if (students.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title={t("results.empty.title", { q })}
        hint={t("results.empty.hint")}
        clear={{
          href: assignHref({}),
          label: t("results.empty.clear"),
          prefetch: false,
        }}
      />
    );
  }

  return (
    <section
      aria-labelledby="assign-results-title"
      className="flex flex-col gap-3"
    >
      <h2 id="assign-results-title" className="text-headline">
        {t("results.title")}
      </h2>
      <ul
        aria-labelledby="assign-results-title"
        className="flex flex-col gap-3"
      >
        {students.map((student) => (
          <li
            key={student.id}
            className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium break-words">
                {student.nombreCompleto}
              </p>
              {student.cif ? (
                <p className="text-muted-foreground text-sm">{student.cif}</p>
              ) : null}
            </div>
            <Link
              href={assignHref({ estudianteId: student.id })}
              prefetch={false}
              aria-label={t("results.chooseLabel", {
                student: student.nombreCompleto,
              })}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("results.choose")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
