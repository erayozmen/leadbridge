export type VrRecordFieldErrors = Partial<
  Record<"firstName" | "lastName" | "schoolId" | "phone", string[]>
>;

export type CreateVrRecordResult =
  | {
      ok: true;
      record: {
        id: string;
        firstName: string;
        lastName: string;
        school: string;
        phone: string | null;
        createdAt: Date;
      };
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "UNAUTHORIZED" | "USER_INACTIVE" | "CREATE_FAILED";
      message: string;
      fieldErrors?: VrRecordFieldErrors;
    };
