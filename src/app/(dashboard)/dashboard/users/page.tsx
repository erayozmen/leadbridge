import { UsersRound } from "lucide-react";
import { DashboardPage, DashboardSection } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/features/auth/server/auth";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { RevokeUserAccess } from "@/features/users/components/revoke-user-access";
import { UserAccessControl } from "@/features/users/components/user-access-control";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const actor = await requireAdmin();
  const [users, activeAdminCount] = await Promise.all([
    prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true, auditLogs: { where: { action: "USER_ACCESS_REVOKED" }, select: { id: true }, take: 1 } }, orderBy: { fullName: "asc" } }),
    prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
  ]);
  return <DashboardPage>
    <PageHeader icon={UsersRound} title="Kullanıcılar" description="Rol, hesap durumu ve uygulama erişimini denetimli işlemlerle yönetin." />
    <DashboardSection><Card><CardHeader><CardTitle>Yeni kullanıcı</CardTitle><CardDescription>Yeni ekip üyesinin kimlik ve erişim bilgilerini tanımlayın.</CardDescription></CardHeader><CardContent><CreateUserForm /></CardContent></Card></DashboardSection>
    <DashboardSection><Card className="gap-0 overflow-hidden py-0"><Table><TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Rol</TableHead><TableHead>Durum</TableHead><TableHead>Oluşturulma</TableHead><TableHead>Yönetim</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => { const isSelf = user.id === actor.id; const isLastActiveAdmin = user.role === "ADMIN" && user.status === "ACTIVE" && activeAdminCount <= 1; const isAccessRevoked = user.auditLogs.length > 0; return <TableRow key={user.id}><TableCell><span className="font-medium">{user.fullName}</span><br/><span className="text-xs text-muted-foreground">{user.email}</span></TableCell><TableCell><StatusBadge status={user.role} /></TableCell><TableCell><StatusBadge status={user.status} /></TableCell><TableCell>{user.createdAt.toLocaleDateString("tr-TR")}</TableCell><TableCell><div className="grid min-w-48 gap-3"><UserAccessControl userId={user.id} role={user.role} status={user.status} isSelf={isSelf} isAccessRevoked={isAccessRevoked}/><RevokeUserAccess userId={user.id} disabled={isSelf || isLastActiveAdmin || isAccessRevoked}/></div></TableCell></TableRow>; })}</TableBody></Table></Card></DashboardSection>
  </DashboardPage>;
}
