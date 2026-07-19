import type { SchoolStatus } from "@prisma/client";

export type SchoolResult =
  | { ok: true; message: string }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "SCHOOL_NOT_FOUND" | "SCHOOL_ALREADY_EXISTS" | "CREATE_FAILED" | "UPDATE_FAILED" | "STATUS_FAILED"; message: string; fieldErrors?: { name?: string[] } };
export type SchoolMutationDependencies = {
  requireAdmin: () => Promise<unknown>;
  create: (data: { name: string; normalizedName: string }) => Promise<unknown>;
  update: (id: string, data: { name: string; normalizedName: string }) => Promise<number>;
  setStatus: (id: string, status: SchoolStatus) => Promise<number>;
};
