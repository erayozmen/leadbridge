export function canAssignQrCode(role: "ADMIN" | "STAFF"): boolean {
  return role === "ADMIN";
}
