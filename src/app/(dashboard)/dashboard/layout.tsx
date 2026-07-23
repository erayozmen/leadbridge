import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireActiveUser } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();

  let user;

  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar role={user.role} />
      <div data-dashboard-content className="min-h-screen lg:pl-68">
        <DashboardHeader
          user={{ fullName: user.fullName, email: user.email, role: user.role }}
        />
        {children}
      </div>
    </div>
  );
}
