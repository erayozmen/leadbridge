"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/features/auth/server/auth";
import { prisma } from "@/lib/prisma";

const idSchema = z.string().trim().min(1).max(100);

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(formData.get("notificationId"));
  if (!parsed.success) return;
  await prisma.notification.updateMany({
    where: { id: parsed.data, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await requireActiveUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}
