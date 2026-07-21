import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const eventMigration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260721070000_add_event_model_and_backfill/migration.sql",
  ),
  "utf8",
);

describe("multi-event migration", () => {
  it("backfills before enforcing required event relations", () => {
    expect(eventMigration).toContain("leadbridge-legacy-event");
    expect(eventMigration).toContain("U&'Ge\\00E7mi\\015F Kay\\0131tlar'");
    expect(eventMigration.indexOf('UPDATE "VrRecord"')).toBeLessThan(
      eventMigration.indexOf(
        'ALTER TABLE "VrRecord" ALTER COLUMN "eventId" SET NOT NULL',
      ),
    );
  });

  it("does not contain destructive data operations", () => {
    expect(eventMigration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
