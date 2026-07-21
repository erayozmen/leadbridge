import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthError, type AppUser } from "@/features/auth/types/auth";
import { createStudentMatch, type CreateStudentMatchDependencies } from "@/features/student-matching/services/create-student-match";
vi.mock("server-only", () => ({}));

const admin: AppUser = { id:"admin_1", authUserId:"auth_1", email:"a@test.dev", fullName:"Admin", role:UserRole.ADMIN, status:UserStatus.ACTIVE };
type Options={vr?:{id:string;eventId?:string;matched:boolean}|null;registration?:{id:string;eventId?:string;matched:boolean}|null;error?:unknown};
function deps(o:Options={}) { const tx={findVr:vi.fn(async()=>o.vr===undefined?{id:"vr_1",eventId:"event_1",matched:false}:o.vr),findRegistration:vi.fn(async()=>o.registration===undefined?{id:"reg_1",eventId:"event_1",matched:false}:o.registration),create:vi.fn(async(data:{matchedByUserId:string;matchedAt:Date})=>{if(o.error)throw o.error;return{id:"match_1",matchedAt:data.matchedAt};})}; const d:CreateStudentMatchDependencies={requireAdmin:vi.fn(async()=>admin),runTransaction:vi.fn(async cb=>cb(tx))}; return{d,tx}; }
const input={vrRecordId:"vr_1",qrRegistrationId:"reg_1"};
describe("createStudentMatch",()=>{
  it("matches two unmatched records for ADMIN",async()=>{await expect(createStudentMatch(input,deps().d)).resolves.toMatchObject({ok:true});});
  it("rejects STAFF",async()=>{const {d}=deps();d.requireAdmin=vi.fn(async()=>{throw new AuthError("FORBIDDEN")});await expect(createStudentMatch(input,d)).resolves.toMatchObject({ok:false,code:"UNAUTHORIZED"});});
  it("rejects invalid ids",async()=>{const {d}=deps();await expect(createStudentMatch({vrRecordId:"",qrRegistrationId:""},d)).resolves.toMatchObject({code:"INVALID_INPUT"});expect(d.requireAdmin).not.toHaveBeenCalled();});
  it("returns VR_RECORD_NOT_FOUND",async()=>{await expect(createStudentMatch(input,deps({vr:null}).d)).resolves.toMatchObject({code:"VR_RECORD_NOT_FOUND"});});
  it("returns QR_REGISTRATION_NOT_FOUND",async()=>{await expect(createStudentMatch(input,deps({registration:null}).d)).resolves.toMatchObject({code:"QR_REGISTRATION_NOT_FOUND"});});
  it("rejects an already matched VR",async()=>{await expect(createStudentMatch(input,deps({vr:{id:"vr_1",matched:true}}).d)).resolves.toMatchObject({code:"VR_ALREADY_MATCHED"});});
  it("rejects an already matched registration",async()=>{await expect(createStudentMatch(input,deps({registration:{id:"reg_1",matched:true}}).d)).resolves.toMatchObject({code:"QR_REGISTRATION_ALREADY_MATCHED"});});
  it("rejects records from different events",async()=>{await expect(createStudentMatch(input,deps({vr:{id:"vr_1",eventId:"event_1",matched:false},registration:{id:"reg_1",eventId:"event_2",matched:false}}).d)).resolves.toMatchObject({code:"MATCH_CONFLICT"});});
  it("uses authenticated ADMIN id and server time",async()=>{const {d,tx}=deps();await createStudentMatch(input,d);expect(tx.create).toHaveBeenCalledWith(expect.objectContaining({matchedByUserId:"admin_1",matchedAt:expect.any(Date)}));});
  it("maps P2002 to MATCH_CONFLICT",async()=>{const error=new Prisma.PrismaClientKnownRequestError("raw",{code:"P2002",clientVersion:"7.8.0"});await expect(createStudentMatch(input,deps({error}).d)).resolves.toMatchObject({code:"MATCH_CONFLICT"});});
  it("does not return success on transaction failure",async()=>{const {d}=deps();d.runTransaction=vi.fn(async()=>{throw new Error("rollback")});await expect(createStudentMatch(input,d)).resolves.toMatchObject({ok:false,code:"MATCH_FAILED"});});
  it("does not leak raw Prisma errors",async()=>{const {d}=deps();d.runTransaction=vi.fn(async()=>{throw new Error("sensitive")});expect(JSON.stringify(await createStudentMatch(input,d))).not.toContain("sensitive");});
});
