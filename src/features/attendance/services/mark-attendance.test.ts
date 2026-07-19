import{UserRole,UserStatus}from"@prisma/client";import{describe,expect,it,vi}from"vitest";import{AuthError,type AppUser}from"@/features/auth/types/auth";import{markAttendance,type MarkAttendanceDependencies}from"@/features/attendance/services/mark-attendance";
vi.mock("server-only",()=>({}));
const admin:AppUser={id:"admin_1",authUserId:"auth_1",email:"a@test.dev",fullName:"Admin",role:UserRole.ADMIN,status:UserStatus.ACTIVE};
type Options={user?:AppUser;found?:boolean;attended?:boolean;count?:number;afterAttended?:boolean;error?:unknown};
function deps(o:Options={}){let call=0;const d:MarkAttendanceDependencies={requireUser:vi.fn(async()=>o.user??admin),findRegistration:vi.fn(async()=>{call++;if(o.error)throw o.error;if(o.found===false)return null;return{id:"reg_1",attendedEvent:call>1?(o.afterAttended??false):(o.attended??false)}}),updateIfNotAttended:vi.fn(async()=>{if(o.error)throw o.error;return o.count??1})};return d;}
describe("markAttendance",()=>{
it("allows ADMIN",async()=>{await expect(markAttendance({qrRegistrationId:"reg_1"},deps())).resolves.toMatchObject({ok:true});});
it("allows STAFF",async()=>{await expect(markAttendance({qrRegistrationId:"reg_1"},deps({user:{...admin,role:UserRole.STAFF}}))).resolves.toMatchObject({ok:true});});
it("rejects unauthorized users",async()=>{const d=deps();d.requireUser=vi.fn(async()=>{throw new AuthError("UNAUTHENTICATED")});await expect(markAttendance({qrRegistrationId:"reg_1"},d)).resolves.toMatchObject({code:"UNAUTHORIZED"});});
it("rejects invalid id before DB",async()=>{const d=deps();await expect(markAttendance({qrRegistrationId:""},d)).resolves.toMatchObject({code:"INVALID_INPUT"});expect(d.requireUser).not.toHaveBeenCalled();expect(d.findRegistration).not.toHaveBeenCalled();});
it("returns REGISTRATION_NOT_FOUND",async()=>{await expect(markAttendance({qrRegistrationId:"reg_1"},deps({found:false}))).resolves.toMatchObject({code:"REGISTRATION_NOT_FOUND"});});
it("returns ALREADY_ATTENDED",async()=>{const d=deps({attended:true});await expect(markAttendance({qrRegistrationId:"reg_1"},d)).resolves.toMatchObject({code:"ALREADY_ATTENDED"});expect(d.updateIfNotAttended).not.toHaveBeenCalled();});
it("writes attendedEvent true",async()=>{const d=deps();await markAttendance({qrRegistrationId:"reg_1"},d);expect(d.updateIfNotAttended).toHaveBeenCalledWith("reg_1",expect.objectContaining({attendedEvent:true}));});
it("creates attendedAt on server",async()=>{const d=deps();await markAttendance({qrRegistrationId:"reg_1"},d);expect(d.updateIfNotAttended).toHaveBeenCalledWith("reg_1",expect.objectContaining({attendedAt:expect.any(Date)}));});
it("uses authenticated user id",async()=>{const d=deps();await markAttendance({qrRegistrationId:"reg_1"},d);expect(d.updateIfNotAttended).toHaveBeenCalledWith("reg_1",expect.objectContaining({attendedByUserId:"admin_1"}));});
it("ignores client supplied identity and date",async()=>{const d=deps();await markAttendance({qrRegistrationId:"reg_1",userId:"fake",attendedAt:"fake"} as {qrRegistrationId:string},d);expect(d.updateIfNotAttended).toHaveBeenCalledWith("reg_1",expect.objectContaining({attendedByUserId:"admin_1",attendedAt:expect.any(Date)}));});
it("maps count zero followed by attendance to ALREADY_ATTENDED",async()=>{await expect(markAttendance({qrRegistrationId:"reg_1"},deps({count:0,afterAttended:true}))).resolves.toMatchObject({code:"ALREADY_ATTENDED"});});
it("returns ATTENDANCE_CONFLICT when count zero remains unchanged",async()=>{await expect(markAttendance({qrRegistrationId:"reg_1"},deps({count:0,afterAttended:false}))).resolves.toMatchObject({code:"ATTENDANCE_CONFLICT"});});
it("does not overwrite after a concurrent success",async()=>{const d=deps({count:0,afterAttended:true});await markAttendance({qrRegistrationId:"reg_1"},d);expect(d.updateIfNotAttended).toHaveBeenCalledTimes(1);});
it("maps and hides Prisma failures",async()=>{const result=await markAttendance({qrRegistrationId:"reg_1"},deps({error:new Error("sensitive database detail")}));expect(result).toMatchObject({code:"ATTENDANCE_FAILED"});expect(JSON.stringify(result)).not.toContain("sensitive database detail");});
});
