import { describe,expect,it } from "vitest";
import { canManageStudentMatches } from "@/features/student-matching/lib/student-match-permissions";
describe("student match permissions",()=>{it("does not expose match actions to STAFF",()=>{expect(canManageStudentMatches("STAFF")).toBe(false);expect(canManageStudentMatches("ADMIN")).toBe(true);});});
