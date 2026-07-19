"use server";

import { revalidatePath } from "next/cache";

import { createVrRecord } from "@/features/vr-records/services/create-vr-record";
import type { VrRecordFieldErrors } from "@/features/vr-records/types/vr-record-result";

export type VrRecordActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: VrRecordFieldErrors;
};

function getTextField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createVrRecordAction(
  _previousState: VrRecordActionState,
  formData: FormData,
): Promise<VrRecordActionState> {
  const result = await createVrRecord({
    firstName: getTextField(formData, "firstName"),
    lastName: getTextField(formData, "lastName"),
    schoolId: getTextField(formData, "schoolId"),
    phone: getTextField(formData, "phone"),
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/dashboard/vr-records");

  return {
    status: "success",
    message: `${result.record.firstName} ${result.record.lastName} için VR kaydı oluşturuldu.`,
  };
}
