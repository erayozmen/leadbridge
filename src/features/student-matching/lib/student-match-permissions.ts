export function canManageStudentMatches(role: "ADMIN" | "STAFF"): boolean {
  return role === "ADMIN";
}
