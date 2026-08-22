export const INTRO_STORAGE_KEY = "leadbridges-intro-seen";

export type IntroMode = "full" | "short" | "static";

export function chooseIntroMode({ reducedMotion, compactViewport, seenInSession }: {
  reducedMotion: boolean;
  compactViewport: boolean;
  seenInSession: boolean;
}): IntroMode {
  if (reducedMotion) return "static";
  if (compactViewport || seenInSession) return "short";
  return "full";
}

export function getLogoRevealDelay(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 5_400;
  return Math.max(0, (duration - 1) * 1_000);
}
