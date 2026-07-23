import { redirect } from "next/navigation";

import { requireActiveUser } from "@/features/auth/server/auth";
import { AuthError } from "@/features/auth/types/auth";

export default async function SelectEventPage() {
  try {
    await requireActiveUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }
  redirect("/dashboard");
}
