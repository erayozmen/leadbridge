import { UserRole } from "@prisma/client";

export function canMarkAttendance(attendedEvent: boolean): boolean {
  return !attendedEvent;
}

export function canReverseAttendance(
  role: UserRole,
  attendedEvent: boolean,
): boolean {
  return role === UserRole.ADMIN && attendedEvent;
}
