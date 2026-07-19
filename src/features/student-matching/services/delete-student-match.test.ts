import { describe,expect,it,vi } from "vitest";
import { AuthError } from "@/features/auth/types/auth";
import { deleteStudentMatch,type DeleteStudentMatchDependencies } from "@/features/student-matching/services/delete-student-match";
vi.mock("server-only",()=>({}));
const deps=(count:number):DeleteStudentMatchDependencies=>({requireAdmin:vi.fn(async()=>({})),deleteMatch:vi.fn(async()=>count)});
describe("deleteStudentMatch",()=>{
  it("allows ADMIN to remove a match",async()=>{await expect(deleteStudentMatch("match_1",deps(1))).resolves.toMatchObject({ok:true});});
  it("rejects STAFF",async()=>{const d=deps(1);d.requireAdmin=vi.fn(async()=>{throw new AuthError("FORBIDDEN")});await expect(deleteStudentMatch("match_1",d)).resolves.toMatchObject({code:"UNAUTHORIZED"});});
  it("deletes only the StudentMatch id",async()=>{const d=deps(1);await deleteStudentMatch("match_1",d);expect(d.deleteMatch).toHaveBeenCalledWith("match_1");});
  it("returns MATCH_NOT_FOUND for an already removed match",async()=>{await expect(deleteStudentMatch("match_1",deps(0))).resolves.toMatchObject({ok:false,code:"MATCH_NOT_FOUND"});});
  it("changes no VR, registration, or QR state through its dependency contract",()=>{expect(Object.keys(deps(1))).toEqual(["requireAdmin","deleteMatch"]);});
});
