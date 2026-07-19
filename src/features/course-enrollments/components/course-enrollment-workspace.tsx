"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CourseEnrollmentList } from "@/features/course-enrollments/components/course-enrollment-list";
import { LanguageSchoolVerificationPanel } from "@/features/course-enrollments/components/language-school-verification-panel";
import type {
  CourseEnrollmentFilters,
  CourseEnrollmentListItem,
} from "@/features/course-enrollments/queries/list-course-enrollments";
import {
  getLanguageSchoolStudentEligibility,
  selectAllLanguageSchoolStudents,
  toggleLanguageSchoolSelection,
  type StudentEligibility,
} from "@/features/course-enrollments/lib/language-school-selection";

type Props = {
  records: CourseEnrollmentListItem[];
  total: number;
  page: number;
  pageCount: number;
  hasFilters: boolean;
  filters: CourseEnrollmentFilters;
  schools: Array<{ id: string; name: string }>;
};

export function CourseEnrollmentWorkspace(props: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

  const eligibilityById = useMemo(
    () =>
      new Map<string, StudentEligibility>(
        props.records.map((record) => [record.id, getLanguageSchoolStudentEligibility(record)]),
      ),
    [props.records],
  );
  const selectableIds = useMemo(
    () =>
      props.records
        .filter((record) => eligibilityById.get(record.id)?.eligible)
        .map((record) => record.id),
    [eligibilityById, props.records],
  );
  const selectableIdSet = useMemo(() => new Set(selectableIds), [selectableIds]);

  function toggleSelection(id: string) {
    const next = toggleLanguageSchoolSelection(selectedIds, id, selectableIdSet);
    setSelectedIds(next.selectedIds);
    setSelectionWarning(
      next.limitReached ? "Toplu sorgu için en fazla 100 öğrenci seçebilirsiniz." : null,
    );
  }

  function selectAll() {
    const next = selectAllLanguageSchoolStudents(selectableIds);
    setSelectedIds(next.selectedIds);
    setSelectionWarning(
      next.limitReached ? "İlk 100 uygun öğrenci seçildi. Tek sorguda en fazla 100 kayıt seçilebilir." : null,
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionWarning(null);
  }

  return (
    <>
      <LanguageSchoolVerificationPanel selectedCount={selectedIds.size} results={[]} />
      <Card className="mt-6 gap-0 overflow-hidden rounded-lg py-0 shadow-none">
        <CourseEnrollmentList
          {...props}
          eligibilityById={eligibilityById}
          selectedIds={selectedIds}
          selectionWarning={selectionWarning}
          onToggleSelection={toggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
        />
      </Card>
    </>
  );
}
