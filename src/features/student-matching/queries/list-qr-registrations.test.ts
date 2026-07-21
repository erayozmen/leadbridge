import { describe,expect,it,vi } from "vitest";
import { listQrRegistrations,REGISTRATIONS_PAGE_SIZE,type RegistrationListDependencies } from "@/features/student-matching/queries/list-qr-registrations";
vi.mock("server-only",()=>({}));
const deps=():RegistrationListDependencies=>({count:vi.fn(async()=>45),findMany:vi.fn(async()=>[])});
describe("listQrRegistrations",()=>{
  it("limits selection to unmatched registrations",async()=>{const d=deps();await listQrRegistrations({}, {unmatchedOnly:true},d);expect(d.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{studentMatch:null}}));});
  it.each([["firstName","Ayşe"],["lastName","Yılmaz"],["school","X Okulu"]] as const)("applies %s filter",async(key,value)=>{const d=deps();await listQrRegistrations({[key]:value}, {},d);expect(d.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{[key]:{contains:value,mode:"insensitive"}}}));});
  it("calculates pagination",async()=>{const d=deps();await listQrRegistrations({page:3},{},d);expect(d.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:50,take:REGISTRATIONS_PAGE_SIZE}));});
  it("selects match status and linked VR without token fields",async()=>{const d=deps();await listQrRegistrations({}, {},d);const args=vi.mocked(d.findMany).mock.calls[0][0];expect(args.select).toHaveProperty("studentMatch");expect(args.select).not.toHaveProperty("qrCode.tokenHash");expect(JSON.stringify(args.select)).not.toContain("tokenHash");});
});
