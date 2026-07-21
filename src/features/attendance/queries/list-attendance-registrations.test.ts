import{describe,expect,it,vi}from"vitest";import{ATTENDANCE_PAGE_SIZE,listAttendanceRegistrations,type AttendanceListDependencies}from"@/features/attendance/queries/list-attendance-registrations";
vi.mock("server-only",()=>({}));const deps=():AttendanceListDependencies=>({count:vi.fn(async()=>45),findMany:vi.fn(async()=>[])});
describe("listAttendanceRegistrations",()=>{
it.each([["firstName","Ayşe","insensitive"],["lastName","Yılmaz","insensitive"],["school","X Okulu","insensitive"],["phone","0532",undefined]] as const)("applies %s filter",async(key,value,mode)=>{const d=deps();await listAttendanceRegistrations({[key]:value},d);expect(d.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{[key]:mode?{contains:value,mode}:{contains:value}}}));});
it("combines multiple filters",async()=>{const d=deps();await listAttendanceRegistrations({firstName:"A",school:"X",phone:"05"},d);const where=vi.mocked(d.findMany).mock.calls[0][0].where;expect(where).toEqual(expect.objectContaining({firstName:expect.anything(),school:expect.anything(),phone:expect.anything()}));});
it("calculates pagination",async()=>{const d=deps();await listAttendanceRegistrations({page:3},d);expect(d.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:50,take:ATTENDANCE_PAGE_SIZE}));});
it("never selects token fields",async()=>{const d=deps();await listAttendanceRegistrations({},d);const select=vi.mocked(d.findMany).mock.calls[0][0].select;expect(JSON.stringify(select)).not.toContain("token");});
it("does not require a StudentMatch",async()=>{const d=deps();await listAttendanceRegistrations({},d);const where=vi.mocked(d.findMany).mock.calls[0][0].where;expect(where).not.toHaveProperty("studentMatch");});
});
