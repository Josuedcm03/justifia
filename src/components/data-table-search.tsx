import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A plain server-rendered `<form method="get">` (design.md decision 22): no
 * `"use client"`, no debounce, works with JavaScript disabled. Omitting a
 * `page` field means a new search always lands on page 1 with no reset
 * logic — the browser simply drops any stale `page` query param on submit.
 */
export function DataTableSearch({
  action,
  value,
  label,
  placeholder,
  submitLabel,
  clearLabel,
}: {
  action: string;
  value: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  clearLabel: string;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q" className="sr-only">
          {label}
        </Label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          className="h-11"
        />
      </div>
      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
      {value ? (
        <Link
          href={action}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {clearLabel}
        </Link>
      ) : null}
    </form>
  );
}
