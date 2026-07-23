import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteMatchButton } from "@/features/student-matching/components/match-action-buttons";
import { canManageStudentMatches } from "@/features/student-matching/lib/student-match-permissions";

type MatchSummary = {
  id: string;
  vrRecord: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export function QrRegistrationMatchCell({
  role,
  registration,
}: {
  role: UserRole;
  registration: {
    id: string;
    firstName: string;
    lastName: string;
    studentMatch: MatchSummary | null;
  };
}) {
  const match = registration.studentMatch;
  if (!match) return <Badge variant="secondary">Eşleşmedi</Badge>;

  const vrStudentName = `${match.vrRecord.firstName} ${match.vrRecord.lastName}`;
  return (
    <div className="min-w-56 space-y-2">
      <div>
        <Badge>Eşleşti</Badge>
        <Button asChild variant="link" size="sm">
          <Link href={`/dashboard/vr-records/${match.vrRecord.id}/match-registration`}>
            {vrStudentName}
          </Link>
        </Button>
      </div>
      {canManageStudentMatches(role) ? (
        <DeleteMatchButton
          matchId={match.id}
          vrRecordId={match.vrRecord.id}
          qrRegistrationId={registration.id}
          vrStudentName={vrStudentName}
          qrStudentName={`${registration.firstName} ${registration.lastName}`}
        />
      ) : null}
    </div>
  );
}
