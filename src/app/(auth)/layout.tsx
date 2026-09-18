import type { ReactNode } from "react";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-svh place-items-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Image
          src="/uam-seeklogo.png"
          alt="Universidad Americana"
          width={64}
          height={64}
          priority
        />
        {children}
      </div>
    </div>
  );
}
