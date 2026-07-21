import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/features/auth/server/auth";
import { UserAccessControl } from "@/features/users/components/user-access-control";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const actor = await requireAdmin();
  const users = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true }, orderBy: { fullName: "asc" } });
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold">Kullanıcılar</h1><p className="mt-2 text-muted-foreground">Rol ve hesap durumlarını iki aşamalı, denetimli işlemlerle yönetin.</p><Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Rol</TableHead><TableHead>Durum</TableHead><TableHead>Oluşturulma</TableHead><TableHead>Yönetim</TableHead></TableRow></TableHeader><TableBody>{users.map(user=><TableRow key={user.id}><TableCell><span className="font-medium">{user.fullName}</span><br/><span className="text-xs text-muted-foreground">{user.email}</span></TableCell><TableCell>{user.role}</TableCell><TableCell>{user.status}</TableCell><TableCell>{user.createdAt.toLocaleDateString("tr-TR")}</TableCell><TableCell><UserAccessControl userId={user.id} role={user.role} status={user.status} isSelf={user.id===actor.id}/></TableCell></TableRow>)}</TableBody></Table></div></Card></main>;
}
