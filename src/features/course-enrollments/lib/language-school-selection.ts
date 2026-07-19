import { LANGUAGE_SCHOOL_BATCH_LIMIT } from "@/features/course-enrollments/integrations/language-school-contract";

export type LanguageSchoolSelectionRecord = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type QueryableStudent = {
  leadBridgeRegistrationId: string;
  firstName: string;
  lastName: string;
  normalizedPhone: string;
};

export type StudentEligibility =
  | { eligible: true; student: QueryableStudent }
  | { eligible: false; reason: string };

export type SelectionChange = {
  selectedIds: Set<string>;
  limitReached: boolean;
};

export function getLanguageSchoolStudentEligibility(
  record: LanguageSchoolSelectionRecord,
): StudentEligibility {
  const id = record.id.trim();
  const firstName = record.firstName.trim();
  const lastName = record.lastName.trim();
  const normalizedPhone = record.phone.replace(/\D/g, "");

  if (!id || !firstName || !lastName) {
    return { eligible: false, reason: "Ad, soyad veya kayıt bilgisi eksik." };
  }

  if (!/^\d{10,15}$/.test(normalizedPhone)) {
    return { eligible: false, reason: "Telefon numarası toplu sorgu için uygun değil." };
  }

  return {
    eligible: true,
    student: {
      leadBridgeRegistrationId: id,
      firstName,
      lastName,
      normalizedPhone,
    },
  };
}

export function toggleLanguageSchoolSelection(
  selectedIds: ReadonlySet<string>,
  id: string,
  selectableIds: ReadonlySet<string>,
): SelectionChange {
  const next = new Set(selectedIds);

  if (next.has(id)) {
    next.delete(id);
    return { selectedIds: next, limitReached: false };
  }

  if (!selectableIds.has(id)) {
    return { selectedIds: next, limitReached: false };
  }

  if (next.size >= LANGUAGE_SCHOOL_BATCH_LIMIT) {
    return { selectedIds: next, limitReached: true };
  }

  next.add(id);
  return { selectedIds: next, limitReached: false };
}

export function selectAllLanguageSchoolStudents(selectableIds: readonly string[]): SelectionChange {
  return {
    selectedIds: new Set(selectableIds.slice(0, LANGUAGE_SCHOOL_BATCH_LIMIT)),
    limitReached: selectableIds.length > LANGUAGE_SCHOOL_BATCH_LIMIT,
  };
}

export function canRunLanguageSchoolLookup(selectedCount: number, providerAvailable: boolean) {
  return providerAvailable && selectedCount >= 1 && selectedCount <= LANGUAGE_SCHOOL_BATCH_LIMIT;
}
