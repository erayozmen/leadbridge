import { Card } from "@/components/ui/card";
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

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
    <h1 className="text-3xl font-semibold">Kullanıcılar</h1>
    <p className="mt-2 text-muted-foreground">Rol, hesap durumu ve uygulama erişimini denetimli işlemlerle yönetin.</p>
    <Card className="mt-8 p-5"><h2 className="mb-4 font-semibold">Yeni Kullanıcı</h2><CreateUserForm /></Card>
    <Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Rol</TableHead><TableHead>Durum</TableHead><TableHead>Oluşturulma</TableHead><TableHead>Yönetim</TableHead></TableRow></TableHeader>
      <TableBody>{users.map((user) => {
        const isSelf = user.id === actor.id;
        const isLastActiveAdmin = user.role === "ADMIN" && user.status === "ACTIVE" && activeAdminCount <= 1;
        const isAccessRevoked = user.auditLogs.length > 0;
        return <TableRow key={user.id}><TableCell><span className="font-medium">{user.fullName}</span><br/><span className="text-xs text-muted-foreground">{user.email}</span></TableCell><TableCell>{user.role}</TableCell><TableCell>{user.status}</TableCell><TableCell>{user.createdAt.toLocaleDateString("tr-TR")}</TableCell><TableCell><div className="grid gap-3"><UserAccessControl userId={user.id} role={user.role} status={user.status} isSelf={isSelf} isAccessRevoked={isAccessRevoked}/><RevokeUserAccess userId={user.id} disabled={isSelf || isLastActiveAdmin || isAccessRevoked}/></div></TableCell></TableRow>;
      })}</TableBody>
    </Table></div></Card>
  </main>;
}
