export const LANGUAGE_SCHOOL_BATCH_LIMIT = 100;

export type LanguageSchoolStudentInput = {
  leadBridgeRegistrationId: string;
  firstName: string;
  lastName: string;
  normalizedPhone: string;
};

export type LanguageSchoolMatchStatus = "FOUND" | "NOT_FOUND" | "AMBIGUOUS" | "ERROR";

export type LanguageSchoolSafeResult = {
  leadBridgeRegistrationId: string;
  matchStatus: LanguageSchoolMatchStatus;
};
