import { redirect } from "next/navigation";

import { requireActiveUser } from "@/features/auth/server/auth";

export default async function NotificationsPage() {
  await requireActiveUser();
  redirect("/dashboard");
}
