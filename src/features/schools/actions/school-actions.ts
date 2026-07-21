"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/auth";
import {
  createSchool,
  setSchoolStatus,
  updateSchool,
} from "@/features/schools/services/school-service";

export type SchoolActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldError?: string;
};

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

async function authorizeAdmin(): Promise<SchoolActionState | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return {
      status: "error",
      message: "Bu işlem yalnızca yöneticiler tarafından yapılabilir.",
    };
  }
}

function state(
  result: Awaited<ReturnType<typeof createSchool>>,
): SchoolActionState {
  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldError: result.fieldErrors?.name?.[0],
    };
  }
  revalidatePath("/dashboard/schools");
  return { status: "success", message: result.message };
}

export async function createSchoolAction(
  _state: SchoolActionState,
  data: FormData,
) {
  const authFailure = await authorizeAdmin();
  return authFailure ?? state(await createSchool({ name: text(data, "name") }));
}

export async function updateSchoolAction(
  _state: SchoolActionState,
  data: FormData,
) {
  const authFailure = await authorizeAdmin();
  return authFailure ?? state(await updateSchool({
    id: text(data, "id"),
    name: text(data, "name"),
  }));
}

export async function setSchoolStatusAction(
  _state: SchoolActionState,
  data: FormData,
) {
  const authFailure = await authorizeAdmin();
  return authFailure ?? state(await setSchoolStatus({
    id: text(data, "id"),
    status: text(data, "status"),
  }));
}
