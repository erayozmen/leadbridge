import { defineConfig } from "prisma/config";
import { existsSync, readFileSync } from "node:fs";

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        return [key, value.replace(/^["']|["']$/g, "")];
      })
      .filter(([key]) => key.length > 0),
  );
}

const localEnv = readEnvFile(".env.local");
const directUrl = process.env.DIRECT_URL ?? localEnv.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: directUrl,
  },
});
