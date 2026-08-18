import "server-only";
import { prisma } from "@/lib/prisma";
import { getNextAcademySyncTime } from "./schedule";
export async function getAcademySyncMonitoring(historyPage = 1) {
  const take = 10, page = Math.max(1, historyPage);
  const [latest, total, history] = await Promise.all([prisma.academySyncRun.findFirst({ where: { status: { not: "RUNNING" } }, orderBy: { startedAt: "desc" } }), prisma.academySyncRun.count(), prisma.academySyncRun.findMany({ orderBy: { startedAt: "desc" }, skip: (page - 1) * take, take })]);
  return { latest, history, page, pageCount: Math.max(1, Math.ceil(total / take)), nextScheduledAt: getNextAcademySyncTime() };
}
