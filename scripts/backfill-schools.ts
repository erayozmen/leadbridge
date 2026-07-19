import { existsSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const cleanSchoolName = (name: string) => name.trim().replace(/\s+/g, " ");
const normalizeSchoolName = (name: string) => cleanSchoolName(name).toLocaleLowerCase("tr-TR");
function buildSchoolBackfillEntries(values: string[]) {
  const entries = new Map<string, string>();
  for (const value of values) { const name = cleanSchoolName(value); if (name) entries.set(normalizeSchoolName(name), entries.get(normalizeSchoolName(name)) ?? name); }
  return [...entries].map(([normalizedName, name]) => ({ normalizedName, name }));
}

function readLocalDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (direct) return direct;
  if (!existsSync(".env.local")) throw new Error("DATABASE_URL is missing");
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is missing");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: readLocalDatabaseUrl() }) });

try {
  const [vrRows, qrRows] = await Promise.all([
    prisma.vrRecord.findMany({ where: { schoolId: null }, select: { school: true }, distinct: ["school"] }),
    prisma.qrRegistration.findMany({ where: { schoolId: null }, select: { school: true }, distinct: ["school"] }),
  ]);
  const variants = [...vrRows, ...qrRows].map(({ school }) => school).filter((school) => school.trim().length > 0);
  const names = buildSchoolBackfillEntries(variants);

  let linkedVrRecords = 0; let linkedQrRegistrations = 0;
  for (const { normalizedName, name } of names) {
    const school = await prisma.school.upsert({ where: { normalizedName }, update: {}, create: { name, normalizedName }, select: { id: true } });
    const matchingVariants = variants.filter((value) => normalizeSchoolName(value) === normalizedName);
    const [vr, qr] = await Promise.all([
      prisma.vrRecord.updateMany({ where: { schoolId: null, school: { in: matchingVariants } }, data: { schoolId: school.id } }),
      prisma.qrRegistration.updateMany({ where: { schoolId: null, school: { in: matchingVariants } }, data: { schoolId: school.id } }),
    ]);
    linkedVrRecords += vr.count; linkedQrRegistrations += qr.count;
  }
  const [schoolCount, unmatchedVrRecords, unmatchedQrRegistrations] = await Promise.all([
    prisma.school.count(),
    prisma.vrRecord.count({ where: { schoolId: null } }),
    prisma.qrRegistration.count({ where: { schoolId: null } }),
  ]);
  process.stdout.write(JSON.stringify({ sourceVrSchoolVariants: vrRows.length, sourceQrSchoolVariants: qrRows.length, uniqueSchools: schoolCount, linkedVrRecords, linkedQrRegistrations, unmatchedVrRecords, unmatchedQrRegistrations }));
} finally {
  await prisma.$disconnect();
}
