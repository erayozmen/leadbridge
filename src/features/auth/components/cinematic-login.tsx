"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";

import { LoginForm } from "@/features/auth/components/login-form";
import { chooseIntroMode, getLogoRevealDelay, INTRO_STORAGE_KEY } from "@/features/auth/components/intro-policy";
import styles from "./cinematic-login.module.css";

type Phase = "ready" | "intro" | "reveal";

export function CinematicLogin() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [showVideo, setShowVideo] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (readyTimer.current) clearTimeout(readyTimer.current);
    if (failureTimer.current) clearTimeout(failureTimer.current);
  }, []);

  const finishIntro = useCallback(() => {
    clearTimers();
    setPhase("reveal");
    setShowVideo(false);
    readyTimer.current = setTimeout(() => setPhase("ready"), 520);
  }, [clearTimers]);

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactViewport = window.matchMedia("(max-width: 767px)").matches;
    let seenInSession = true;
    try {
      seenInSession = sessionStorage.getItem(INTRO_STORAGE_KEY) === "true";
    } catch {
      // Storage is presentation-only; privacy restrictions must not block login.
    }

    const mode = chooseIntroMode({ reducedMotion, compactViewport, seenInSession });
    if (mode === "static") return;
    if (mode === "short") {
      readyTimer.current = setTimeout(() => {
        setPhase("reveal");
        readyTimer.current = setTimeout(() => setPhase("ready"), 720);
      }, 0);
      return clearTimers;
    }

    try {
      sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // A failed write only means the next navigation may replay the enhancement.
    }
    readyTimer.current = setTimeout(() => {
      setPhase("intro");
      setShowVideo(true);
    }, 0);
    failureTimer.current = setTimeout(finishIntro, 4_000);
    return clearTimers;
  }, [clearTimers, finishIntro]);

  const handleMetadata = (video: HTMLVideoElement) => {
    if (phase !== "intro") return;
    if (failureTimer.current) clearTimeout(failureTimer.current);
    failureTimer.current = setTimeout(finishIntro, Math.max(7_500, (video.duration + 1) * 1_000));
    revealTimer.current = setTimeout(() => setPhase("reveal"), getLogoRevealDelay(video.duration));
    void video.play().catch(finishIntro);
  };

  return (
    <main className={styles.scene} data-phase={phase}>
      <div className={styles.ambient} aria-hidden="true"><span className={styles.traceLeft} /><span className={styles.traceRight} /></div>
      {showVideo ? (
        <video className={styles.video} src="/brand/leadbridges-intro.mp4" muted playsInline autoPlay preload="metadata" aria-hidden="true" tabIndex={-1}
          onLoadedMetadata={(event) => handleMetadata(event.currentTarget)} onEnded={finishIntro} onError={finishIntro} onAbort={finishIntro} />
      ) : null}
      <div className={styles.vignette} aria-hidden="true" />
      {phase === "intro" ? <button className={styles.skip} type="button" onClick={finishIntro} aria-label="Sinematik tanıtımı atla">Atla</button> : null}
      <div className={styles.content}>
        <header className={styles.brand} aria-label="LeadBridges">
          <div className={styles.logoShell}>
            <Image className={styles.logo} src="/brand/leadbridges-logo.png" alt="" width={1254} height={1254} priority />
            <span className={styles.sweep} aria-hidden="true" />
          </div>
          <h1 className={styles.brandName}>LeadBridges</h1>
          <p className={styles.tagline}>Connecting Opportunity. Creating Growth.</p>
        </header>
        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.cardHeading}>
            <p className={styles.eyebrow}>Güvenli erişim</p>
            <h2 id="login-title">Hesabınıza giriş yapın</h2>
            <p>Yönetim paneline devam etmek için kurumsal hesabınızı kullanın.</p>
          </div>
          <div className={styles.form}><LoginForm /></div>
        </section>
      </div>
    </main>
  );
}
