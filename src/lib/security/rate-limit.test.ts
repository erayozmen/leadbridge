import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimitsForTests, consumeRateLimit } from "@/lib/security/rate-limit";

describe("rate limit",()=>{beforeEach(clearRateLimitsForTests);it("limits requests in a fixed window",()=>{expect(consumeRateLimit("a",{limit:2,windowMs:1000},0)).toBe(true);expect(consumeRateLimit("a",{limit:2,windowMs:1000},1)).toBe(true);expect(consumeRateLimit("a",{limit:2,windowMs:1000},2)).toBe(false);expect(consumeRateLimit("a",{limit:2,windowMs:1000},1000)).toBe(true);});});
