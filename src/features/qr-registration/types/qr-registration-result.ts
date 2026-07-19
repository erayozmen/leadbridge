export type QrRegistrationErrorCode =
  | "INVALID_INPUT"
  | "QR_NOT_FOUND"
  | "QR_NOT_ASSIGNED"
  | "QR_ALREADY_USED"
  | "QR_DISABLED"
  | "QR_REGISTRATION_CONFLICT"
  | "SCHOOL_NOT_FOUND"
  | "SCHOOL_INACTIVE"
  | "INTERNAL_ERROR";

export type QrRegistrationFieldErrors = Partial<
  Record<
    "token" | "firstName" | "lastName" | "guardianName" | "phone" | "schoolId",
    string[]
  >
>;

export type QrRegistrationSuccess = {
  ok: true;
  registration: {
    id: string;
    qrCodeId: string;
    firstName: string;
    lastName: string;
    guardianName: string;
    phone: string;
    school: string;
    schoolId: string;
    registeredAt: Date;
  };
};

export type QrRegistrationFailure = {
  ok: false;
  code: QrRegistrationErrorCode;
  message: string;
  fieldErrors?: QrRegistrationFieldErrors;
};

export type QrRegistrationResult =
  | QrRegistrationSuccess
  | QrRegistrationFailure;
