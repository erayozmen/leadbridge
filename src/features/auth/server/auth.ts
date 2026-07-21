import "server-only";

import { UserRole, UserStatus } from "@prisma/client";
import { cache } from "react";
import { AuthError, type AppUser, type AuthDependencies, type AuthUser } from "@/features/auth/types/auth";

async function getDefaultDependencies(): Promise<AuthDependencies> {
  const [{ prisma }, { createSupabaseServerClient }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/supabase/server"),
  ]);

  return {
    async getAuthUser() {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email };
    },
    findAppUserByAuthUserId(authUserId) {
      return prisma.user.findUnique({
        where: { authUserId },
        select: { id: true, authUserId: true, email: true, fullName: true, role: true, status: true },
      });
    },
  };
}

async function resolveDependencies(dependencies?: AuthDependencies) {
  return dependencies ?? getDefaultDependencies();
}

export async function getCurrentAuthUser(dependencies?: AuthDependencies): Promise<AuthUser | null> {
  return (await resolveDependencies(dependencies)).getAuthUser();
}

export async function getCurrentAppUser(dependencies?: AuthDependencies): Promise<AppUser | null> {
  const resolved = await resolveDependencies(dependencies);
  const authUser = await resolved.getAuthUser();
  return authUser ? resolved.findAppUserByAuthUserId(authUser.id) : null;
}

export async function requireAuthenticatedUser(dependencies?: AuthDependencies): Promise<AuthUser> {
  const authUser = await getCurrentAuthUser(dependencies);
  if (!authUser) throw new AuthError("UNAUTHENTICATED");
  return authUser;
}

async function resolveActiveUser(resolved: AuthDependencies): Promise<AppUser> {
  const authUser = await resolved.getAuthUser();
  if (!authUser) throw new AuthError("UNAUTHENTICATED");
  const appUser = await resolved.findAppUserByAuthUserId(authUser.id);
  if (!appUser) throw new AuthError("USER_NOT_PROVISIONED");
  if (appUser.status !== UserStatus.ACTIVE) throw new AuthError("USER_INACTIVE");
  return appUser;
}

const getDefaultActiveUser = cache(async () => (
  resolveActiveUser(await getDefaultDependencies())
));

export async function requireActiveUser(dependencies?: AuthDependencies): Promise<AppUser> {
  return dependencies
    ? resolveActiveUser(dependencies)
    : getDefaultActiveUser();
}

export async function requireAdmin(dependencies?: AuthDependencies): Promise<AppUser> {
  const appUser = await requireActiveUser(dependencies);
  if (appUser.role !== UserRole.ADMIN) throw new AuthError("FORBIDDEN");
  return appUser;
}

export async function requireStaffOrAdmin(dependencies?: AuthDependencies): Promise<AppUser> {
  const appUser = await requireActiveUser(dependencies);
  if (![UserRole.ADMIN, UserRole.STAFF].includes(appUser.role)) throw new AuthError("FORBIDDEN");
  return appUser;
}
