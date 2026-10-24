import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * Non-blocking entry notice (RF-04, RN-21): the student has no enrollment, so
 * step 2 would have nothing to offer. Hook-free; the copy arrives as props. The
 * link takes the full row at 360 px and keeps the 44 px target.
 */
export function EnrollmentNotice({
  message,
  linkLabel,
}: {
  message: string;
  linkLabel: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">{message}</p>
      <Link
        href="/enrollment"
        className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
      >
        {linkLabel}
      </Link>
    </div>
  );
}
