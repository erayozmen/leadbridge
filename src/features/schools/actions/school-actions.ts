"use server";
import { revalidatePath } from "next/cache";
import { createSchool, setSchoolStatus, updateSchool } from "@/features/schools/services/school-service";

export type SchoolActionState = { status: "idle" | "success" | "error"; message: string | null; fieldError?: string };
const text = (data: FormData, key: string) => typeof data.get(key) === "string" ? data.get(key) as string : "";
function state(result: Awaited<ReturnType<typeof createSchool>>): SchoolActionState { if (!result.ok) return { status: "error", message: result.message, fieldError: result.fieldErrors?.name?.[0] }; revalidatePath("/dashboard/schools"); return { status: "success", message: result.message }; }
export async function createSchoolAction(_state: SchoolActionState, data: FormData) { void _state; return state(await createSchool({ name: text(data, "name") })); }
export async function updateSchoolAction(_state: SchoolActionState, data: FormData) { void _state; return state(await updateSchool({ id: text(data, "id"), name: text(data, "name") })); }
export async function setSchoolStatusAction(_state: SchoolActionState, data: FormData) { void _state; return state(await setSchoolStatus({ id: text(data, "id"), status: text(data, "status") })); }
