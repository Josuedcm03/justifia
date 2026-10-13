import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/dal";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <SidebarProvider>
      <AppSidebar rol={user.rol} nombre={user.nombre} />
      <SidebarInset>
        <DashboardHeader user={user} />
        <main className="flex-1 px-4 py-6 md:p-8">
          <div className="shell">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
