"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { buildCredentialsCsv } from "@/lib/import/credentials-csv";
import type { TemporaryCredential } from "@/lib/import/types";

const FILE_NAME = "credenciales-docentes.csv";

/**
 * The one-shot credentials export (decisions 9 and 10). The CSV exists only as
 * an in-memory Blob behind an object URL: no request, cookie, web storage or
 * hidden field ever carries it, and the URL is revoked on unmount. The
 * passwords come from the apply's action state and are never rendered.
 */
export function CredentialsDownload({
  credentials,
}: {
  credentials: readonly TemporaryCredential[];
}) {
  const t = useTranslations("catalog.import.credentials");
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasCredentials = credentials.length > 0;

  // The href is assigned to the element directly rather than through state, so
  // each effect run owns exactly one URL and StrictMode's double run leaks
  // nothing.
  useEffect(() => {
    const link = linkRef.current;
    if (!hasCredentials || !link) return;
    const blob = new Blob([buildCredentialsCsv(credentials)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    link.href = url;
    return () => URL.revokeObjectURL(url);
  }, [credentials, hasCredentials]);

  if (!hasCredentials) return null;

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-muted-foreground max-w-prose">{t("notice")}</p>
      <p className="text-sm font-medium">
        {t("count", { count: credentials.length })}
      </p>
      <a
        ref={linkRef}
        download={FILE_NAME}
        className={buttonVariants({ size: "lg" })}
      >
        {t("download")}
      </a>
    </div>
  );
}
