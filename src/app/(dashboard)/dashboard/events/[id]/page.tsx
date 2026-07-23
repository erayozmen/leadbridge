import { redirect } from "next/navigation";

import { requireActiveUser } from "@/features/auth/server/auth";

export default async function EventDetailPage() {
  await requireActiveUser();
  redirect("/dashboard");
}
