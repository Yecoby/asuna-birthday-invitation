import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Music, Music2 } from "lucide-react";
import { event } from "@/lib/event";
import { saveRsvp, type Attendance } from "@/lib/rsvp";
import { submitRsvp } from "@/lib/host-data";
import { createGardenAudio } from "@/lib/garden-audio";
import { loadTimerSettings } from "@/lib/countdown-settings";

type LightboxState = { src: string; alt: string } | null;

const BUTTERFLY_FLIGHTS = [
  { size: 38, color: "#ef83b6", duration: 16, delay: 0, x0: "-8vw", y0: "78vh", x1: "28vw", y1: "42vh", x2: "62vw", y2: "22vh", x3: "108vw", y3: "8vh" },
  { size: 28, color: "#aa70c5", duration: 19, delay: 3, x0: "10vw", y0: "90vh", x1: "40vw", y1: "50vh", x2: "74vw", y2: "18vh", x3: "112vw", y3: "-4vh" },
  { size: 32, color: "#78b98a", duration: 14, delay: 6, x0: "-12vw", y0: "60vh", x1: "22vw", y1: "30vh", x2: "58vw", y2: "12vh", x3: "110vw", y3: "2vh" },
  { size: 24, color: "#f0c35a", duration: 18, delay: 1.5, x0: "4vw", y0: "85vh", x1: "48vw", y1: "55vh", x2: "80vw", y2: "28vh", x3: "115vw", y3: "10vh" },
];

function ButterflyIcon() {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <use href="#icon-butterfly" />
    </svg>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useReveal(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".fairy-invite .reveal"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [active]);
}

function useParallax(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let pending = false;
    const update = () => {
      pending = false;
      const center = window.innerHeight / 2;
      items.forEach((item) => {
        if (reduced) {
          item.style.setProperty("--parallax-y", "0px");
          return;
        }
        const parent = item.parentElement?.getBoundingClientRect() ?? item.getBoundingClientRect();
        if (parent.bottom < -window.innerHeight * 0.25 || parent.top > window.innerHeight * 1.25) return;
        const speed = Number(item.dataset.parallaxSpeed || 0.08);
        const offset = Math.max(-58, Math.min(58, (center - (parent.top + parent.height / 2)) * speed));
        item.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
      });
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [active]);
}

function useSceneActivity(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scenes = Array.from(document.querySelectorAll<HTMLElement>(".motion-scene"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-active", entry.isIntersecting);
        });
      },
      { threshold: 0.12 },
    );
    scenes.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [active]);
}

function useTypedLine(text: string, start: boolean) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 42);
    return () => window.clearInterval(id);
  }, [text, start]);
  return shown;
}

function useCountdown(iso: string, running: boolean) {
  const target = useMemo(() => new Date(iso).getTime(), [iso]);
  const [parts, setParts] = useState({ days: "000", hours: "00", minutes: "00", seconds: "00" });
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setParts({
        days: String(days).padStart(3, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, running]);
  return parts;
}

function spawnGlitter(layer: HTMLElement | null, x: number, y: number, count = 10) {
  if (!layer) return;
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("span");
    el.className = "glitter";
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 46;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    el.style.background = i % 2 === 0 ? "#ffe9b0" : "#ffd0e8";
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }
}

export function InvitationApp() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  const opened = phase === "open";
  const [musicOn, setMusicOn] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [hunt, setHunt] = useState(0);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState("");
  const [wand, setWand] = useState({ x: 0, y: 0, on: false });
  const audio = useRef<ReturnType<typeof createGardenAudio> | null>(null);
  const glitterRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const finalSceneRef = useRef<HTMLElement | null>(null);

  const typed = useTypedLine(event.typingLine, opened);
  const [timerSettings] = useState(() => loadTimerSettings());
  const effectiveDate = timerSettings.customDateISO || event.dateISO;
  const count = useCountdown(effectiveDate, opened && timerSettings.enabled);
  useReveal(opened);
  useParallax(opened);
  useSceneActivity(opened);

  useEffect(() => {
    // Use the uploaded MP3 placed under public/invitation/
    audio.current = createGardenAudio(
      '/invitation/02. What If There Was Pink - The Pirate Fairy Soundtrack - (320 Kbps) (1).mp3'
    );
    return () => audio.current?.stop();
  }, []);

  useEffect(() => {
    document.body.style.overflow = opened ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [opened]);

  const openInvite = useCallback(() => {
    if (phase !== "closed") return;
    const wait = reduced ? 80 : 2500;
    setPhase("opening");
    void audio.current?.start().then(() => setMusicOn(true));
    const origin = glitterRef.current?.getBoundingClientRect();
    spawnGlitter(glitterRef.current, (origin?.width ?? 400) / 2, (origin?.height ?? 400) / 2, 18);
    window.setTimeout(() => setPhase("open"), wait);
  }, [phase, reduced]);

  const toggleMusic = useCallback(async () => {
    const on = await audio.current?.toggle();
    setMusicOn(Boolean(on));
  }, []);

  const onPointer = useCallback((e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "touch" && e.pointerType !== "pen") return;
    setWand({ x: e.clientX, y: e.clientY, on: true });
  }, []);

  const hideWand = useCallback(() => {
    setWand((current) => ({ ...current, on: false }));
  }, []);

  const openPhoto = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
  }, []);

  const closePhoto = useCallback(() => {
    dialogRef.current?.close();
    setLightbox(null);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightbox && !dialog.open) dialog.showModal();
    if (!lightbox && dialog.open) dialog.close();
  }, [lightbox]);

  const collect = useCallback((el: HTMLButtonElement) => {
    if (el.classList.contains("is-collected")) return;
    el.classList.add("is-collected");
    const rect = el.getBoundingClientRect();
    spawnGlitter(glitterRef.current, rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
    setHunt((n) => n + 1);
  }, []);

  const onRsvp = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const guestName = String(data.get("guestName") ?? "").trim();
    const attendance = String(data.get("attendance") ?? "") as Attendance;
    const attendees = Number(data.get("attendees") ?? 0);
    const contact = String(data.get("contact") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const errors: Record<string, string> = {};
    if (guestName.length < 2) errors.guestName = "Please enter the guest name.";
    if (attendance !== "attending" && attendance !== "not-attending") errors.attendance = "Please choose an attendance response.";
    if (!Number.isInteger(attendees) || attendees < 0 || attendees > 10) errors.attendees = "Enter a number from 0 to 10.";
    if (attendance === "attending" && attendees < 1) errors.attendees = "Attending guests must include at least one person.";
    if (contact.replace(/\D/g, "").length < 7) errors.contact = "Please enter a valid contact number.";

    form.querySelectorAll(".field").forEach((field) => field.classList.remove("has-error"));
    form.querySelectorAll(".field-error").forEach((node) => {
      node.textContent = "";
    });
    Object.entries(errors).forEach(([name, msg]) => {
      const input = form.elements.namedItem(name);
      const field =
        input instanceof RadioNodeList
          ? form.querySelector('input[name="attendance"]')?.closest(".field")
          : (input as HTMLElement | null)?.closest(".field");
      field?.classList.add("has-error");
      const err = field?.querySelector(".field-error");
      if (err) err.textContent = msg;
    });
    if (Object.keys(errors).length) {
      setRsvpStatus("Please check the highlighted fields.");
      return;
    }

    setRsvpStatus("Your reply is taking flight…");
    await new Promise((r) => setTimeout(r, 700));
    try {
      // Sent to the invitation's own server so the organizers see it in the Host
      // Desk. Guests need no account; this endpoint only appends a reply.
      await submitRsvp({
        data: { guestName, attendance, attendees, contact, message },
      });
    } catch {
      // Offline / server hiccup: keep the guest's own copy so their reply is not
      // silently lost, and still let them through to the thank-you note.
      saveRsvp({ guestName, attendance, attendees, contact, message });
    }
    setRsvpDone(true);
    setRsvpStatus("");
    const panel = form.getBoundingClientRect();
    spawnGlitter(glitterRef.current, panel.left + panel.width / 2, panel.top + 80, 20);
    window.requestAnimationFrame(() => {
      finalSceneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      finalSceneRef.current?.focus();
    });
  }, []);

  return (
    <div
      className={`fairy-invite ${opened ? "" : "is-locked"}`}
      onPointerMove={opened ? onPointer : undefined}
      onPointerDown={opened ? onPointer : undefined}
      onPointerLeave={opened ? hideWand : undefined}
      onPointerUp={opened ? hideWand : undefined}
      onPointerCancel={opened ? hideWand : undefined}
    >
      <svg className="svg-defs" aria-hidden="true" focusable="false">
        <symbol id="icon-butterfly" viewBox="0 0 64 48">
          <path d="M31 24C20 4 3 2 5 17c1 9 12 13 24 10C16 32 9 43 20 46c8 2 12-7 13-18Z" />
          <path d="M33 24C44 4 61 2 59 17c-1 9-12 13-24 10 13 5 20 16 9 19-8 2-12-7-13-18Z" />
          <ellipse cx="32" cy="25" rx="3" ry="13" />
          <path d="M31 13c-5-5-7-8-7-11M33 13c5-5 7-8 7-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>
      </svg>

      <a className="skip-link" href="#details">
        Skip to details
      </a>

      {phase !== "open" && (
        <section className={`opening ${phase === "opening" ? "is-opening" : ""}`} aria-label="Closed invitation envelope">
          <div className="opening__sky" aria-hidden="true" />
          <div className="opening__sparkles" aria-hidden="true" />
          <svg className="opening-butterfly opening-butterfly--one" aria-hidden="true">
            <use href="#icon-butterfly" />
          </svg>
          <svg className="opening-butterfly opening-butterfly--two" aria-hidden="true">
            <use href="#icon-butterfly" />
          </svg>
          <svg className="opening-butterfly opening-butterfly--three" aria-hidden="true">
            <use href="#icon-butterfly" />
          </svg>
          <button className="envelope" type="button" onClick={openInvite} aria-label="Open invitation">
            <span className="envelope__back" aria-hidden="true" />
            <span className="envelope__card" aria-hidden="true">
              <span className="envelope-card__details">
                <small>{event.envelopeEyebrow}</small>
                <strong>{event.childFullName}</strong>
                <em>
                  {event.dateLabel} · {event.timeLabel}
                </em>
                <span>{event.venueName}</span>
              </span>
            </span>
            <span className="envelope__flap" aria-hidden="true" />
            <span className="envelope__front" aria-hidden="true" />
            <span className="envelope__seal" aria-hidden="true">
              <span>{event.sealLetter}</span>
            </span>
            <span className="envelope__hint">{event.tapHint}</span>
          </button>
          <div className="opening__wash" aria-hidden="true" />
          <p className="opening__assist">{event.openingAssist}</p>
        </section>
      )}

      {opened && (
        <main id="invitation">
          <section className="hero motion-scene is-active" id="hero">
            <div className="hero__background" data-parallax data-parallax-speed="0.08" aria-hidden="true" />
            <div className="hero__veil" aria-hidden="true" />
            <div className="fairy-lights" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className="butterfly-field" aria-hidden="true">
              {BUTTERFLY_FLIGHTS.map((b, i) => (
                <svg
                  key={i}
                  className="floating-butterfly"
                  style={
                    {
                      "--size": `${b.size}px`,
                      "--color": b.color,
                      "--duration": `${b.duration}s`,
                      "--delay": `${b.delay}s`,
                      "--x0": b.x0,
                      "--y0": b.y0,
                      "--x1": b.x1,
                      "--y1": b.y1,
                      "--x2": b.x2,
                      "--y2": b.y2,
                      "--x3": b.x3,
                      "--y3": b.y3,
                    } as CSSProperties
                  }
                >
                  <use href="#icon-butterfly" />
                </svg>
              ))}
            </div>
            <div className="hero__copy reveal is-visible">
              <p className="eyebrow typing-caret" aria-live="polite">
                {typed}
              </p>
              <h1>
                <span className="hero__name">{event.childFullName}</span>
                <em>{event.headline}</em>
              </h1>
              <p className="hero__intro">{event.heroIntro}</p>
              <a className="fg-btn fg-btn--glow" href="#details">
                {event.enterLabel}
              </a>
            </div>
            <div className="hero__petal-floor" aria-hidden="true" />
          </section>

          <section className="details garden-path-scene motion-scene" id="details">
            {/* Fairy-garden atmosphere. Purely decorative and confined to the
                edges/corners so the centre content stays clean and readable. */}
            <div className="fae-bg" aria-hidden="true">
              {["tl", "tr", "bl", "br"].map((pos) => (
                <span key={`bloom-${pos}`} className={`fae-bloom fae-bloom--${pos}`}>
                  <svg viewBox="0 0 200 200" focusable="false">
                    {/* Large five-petal blossom */}
                    <g transform="translate(62 58)">
                      <g fill="#ffd3e6">
                        <ellipse cx="0" cy="-20" rx="12" ry="20" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(72)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(144)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(216)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(288)" />
                      </g>
                      <circle r="7.5" fill="#fff2c4" />
                      <circle r="3" fill="#ffd77a" />
                    </g>
                    {/* Lilac blossom */}
                    <g transform="translate(132 84) scale(0.82)">
                      <g fill="#ddcdf7">
                        <ellipse cx="0" cy="-20" rx="12" ry="20" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(72)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(144)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(216)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(288)" />
                      </g>
                      <circle r="7.5" fill="#fff6de" />
                      <circle r="3" fill="#e8c489" />
                    </g>
                    {/* Small blue blossom */}
                    <g transform="translate(88 140) scale(0.62)">
                      <g fill="#cfe2ff">
                        <ellipse cx="0" cy="-20" rx="12" ry="20" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(72)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(144)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(216)" />
                        <ellipse cx="0" cy="-20" rx="12" ry="20" transform="rotate(288)" />
                      </g>
                      <circle r="7.5" fill="#fffaf0" />
                    </g>
                    {/* Leaves tucked behind the blooms */}
                    <g fill="#b9dcaa" opacity="0.9">
                      <ellipse cx="34" cy="112" rx="8" ry="17" transform="rotate(-38 34 112)" />
                      <ellipse cx="168" cy="140" rx="7" ry="15" transform="rotate(34 168 140)" />
                      <ellipse cx="120" cy="36" rx="7" ry="14" transform="rotate(22 120 36)" />
                    </g>
                  </svg>
                </span>
              ))}
              <span className="fae-vine fae-vine--left" />
              <span className="fae-vine fae-vine--right" />
              <span className="fae-leaves fae-leaves--top" />
              <span className="fae-leaves fae-leaves--bottom" />
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span key={`moth-${n}`} className={`fae-moth fae-moth--${n}`}>
                  <svg viewBox="0 0 100 76" focusable="false">
                    <path
                      d="M50 40C38 22 20 12 8 18c-9 5-6 24 8 31 8 4 22 3 34-9Z"
                      fill="currentColor"
                      opacity="0.92"
                    />
                    <path
                      d="M50 40c12-18 30-28 42-22 9 5 6 24-8 31-8 4-22 3-34-9Z"
                      fill="currentColor"
                      opacity="0.92"
                    />
                    <path
                      d="M50 44c-8 12-20 20-29 17-7-3-5-15 6-20 6-3 15-2 23 3Z"
                      fill="currentColor"
                      opacity="0.75"
                    />
                    <path
                      d="M50 44c8 12 20 20 29 17 7-3 5-15-6-20-6-3-15-2-23 3Z"
                      fill="currentColor"
                      opacity="0.75"
                    />
                    <path d="M50 34v18" stroke="#6b4a72" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
              ))}
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <span key={`spark-${n}`} className={`fae-spark fae-spark--${n}`} />
              ))}
            </div>

            <div className="section-heading reveal">
              <p className="eyebrow">{event.detailsEyebrow}</p>
              <h2>{event.detailsTitle}</h2>
              <p>{event.detailsLead}</p>
            </div>
            <div className="garden-route" aria-label="Celebration details">
              <article className="signpost signpost--date reveal">
                <span className="signpost__icon">✦</span>
                <p className="signpost__label">{event.whenLabel}</p>
                <h3>{event.dateLabel}</h3>
                <p>
                  {event.dayLabel} · {event.timeLabel}
                </p>
              </article>
              <figure className="route-portrait reveal">
                <img src={event.images.portrait} width={1200} height={1800} alt="A flower-draped swing in Iria’s garden" />
              </figure>
              <article className="signpost signpost--venue reveal">
                <span className="signpost__icon">❧</span>
                <p className="signpost__label">{event.whereLabel}</p>
                <h3>{event.venueName}</h3>
                <p>{event.venueCity}</p>
              </article>
              <article className="signpost signpost--theme reveal">
                <span className="signpost__icon">❀</span>
                <p className="signpost__label">{event.celebrationLabel}</p>
                <h3>{event.childFullName}</h3>
                <p>{event.celebrationLine}</p>
              </article>
              <div className="route-lantern route-lantern--one" aria-hidden="true" />
              <div className="route-lantern route-lantern--two" aria-hidden="true" />
            </div>
          </section>

          {timerSettings.enabled && (
            <section className="countdown-scene motion-scene" aria-labelledby="countdownTitle">
              <div className="section-heading section-heading--light reveal">
                <p className="eyebrow">{event.countdownEyebrow}</p>
                <h2 id="countdownTitle">{event.countdownTitle}</h2>
              </div>
              <div className="countdown" role="timer" aria-live="polite">
                <div className="count-orb reveal">
                  <strong>{count.days}</strong>
                  <span>Days</span>
                </div>
                <div className="count-orb reveal">
                  <strong>{count.hours}</strong>
                  <span>Hours</span>
                </div>
                <div className="count-orb reveal">
                  <strong>{count.minutes}</strong>
                  <span>Minutes</span>
                </div>
                <div className="count-orb reveal">
                  <strong>{count.seconds}</strong>
                  <span>Seconds</span>
                </div>
              </div>
            </section>
          )}

          <section className="trail motion-scene" id="fairyTrail" aria-labelledby="trailTitle">
            <div className="section-heading reveal">
              <p className="eyebrow">{event.trailEyebrow}</p>
              <h2 id="trailTitle">{event.trailTitle}</h2>
              <p>{event.trailLead}</p>
            </div>
            <div className="trail__items">
              {event.milestones.map((m) => (
                <article className="trail-stop reveal" key={m.n}>
                  <figure>
                    <img loading="lazy" src={m.image} width={533} height={800} alt={m.alt} />
                  </figure>
                  <div>
                    <span>{m.n}</span>
                    <h3>{m.title}</h3>
                    <p>{m.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="celebrant-scene motion-scene" aria-label="Celebrant portrait scene">
            <img
              className="celebrant-scene__image"
              data-parallax
              data-parallax-speed="0.11"
              src={event.images.swing}
              width={1152}
              height={1728}
              alt="A flower-draped swing waiting in the garden"
            />
            <div className="celebrant-scene__shade" aria-hidden="true" />
            <div className="celebrant-scene__copy reveal">
              <p className="eyebrow">{event.celebrantEyebrow}</p>
              <h2>{event.celebrantTitle}</h2>
              <p>{event.celebrantLead}</p>
            </div>
          </section>

          <section className="hunt motion-scene" id="butterflyHunt" aria-labelledby="huntTitle">
            <div className="section-heading reveal">
              <p className="eyebrow">{event.huntEyebrow}</p>
              <h2 id="huntTitle">{event.huntTitle}</h2>
              <p>{event.huntLead}</p>
            </div>
            <div className="hunt__counter" aria-live="polite">
              {hunt} / 5 found
            </div>
            <div className="hunt__garden" aria-label="Butterfly hunt play area">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`hunt-butterfly hunt-butterfly--${n}`}
                  type="button"
                  aria-label={`Collect butterfly ${n}`}
                  onClick={(ev) => collect(ev.currentTarget)}
                >
                  <ButterflyIcon />
                </button>
              ))}
              {hunt >= 5 && (
                <div className="hunt__badge">
                  <ButterflyIcon />
                  <strong>{event.huntBadgeTitle}</strong>
                  <span>{event.huntBadgeSub}</span>
                </div>
              )}
            </div>
          </section>

          <section className="editorial-gallery motion-scene" id="gallery" aria-labelledby="galleryTitle">
            <div className="section-heading reveal">
              <p className="eyebrow">{event.galleryEyebrow}</p>
              <h2 id="galleryTitle">{event.galleryTitle}</h2>
            </div>
            <div className="editorial-layout">
              <button
                className="editorial-feature reveal"
                type="button"
                onClick={() => openPhoto(event.gallery[0].full, event.gallery[0].alt)}
                aria-label={`Open ${event.gallery[0].alt}`}
              >
                <img loading="lazy" src={event.gallery[0].src} alt={event.gallery[0].alt} />
                <span>Open memory</span>
              </button>
              <button
                className="editorial-small editorial-small--one reveal"
                type="button"
                onClick={() => openPhoto(event.gallery[1].full, event.gallery[1].alt)}
              >
                <img loading="lazy" src={event.gallery[1].src} alt={event.gallery[1].alt} />
              </button>
              <button
                className="editorial-small editorial-small--two reveal"
                type="button"
                onClick={() => openPhoto(event.gallery[2].full, event.gallery[2].alt)}
              >
                <img loading="lazy" src={event.gallery[2].src} alt={event.gallery[2].alt} />
              </button>
            </div>
            <div className="photo-strip" aria-hidden="true">
              <div className="photo-strip__track">
                {[...event.meadow, ...event.meadow].map((item, i) => (
                  <img key={`${item.src}-${i}`} loading="lazy" src={item.src} alt="" />
                ))}
              </div>
            </div>
          </section>

          <section className="masonry-section motion-scene" aria-labelledby="masonryTitle">
            <div className="section-heading reveal">
              <p className="eyebrow">{event.meadowEyebrow}</p>
              <h2 id="masonryTitle">{event.meadowTitle}</h2>
            </div>
            <div className="masonry-gallery">
              {event.meadow.map((item) => (
                <button
                  key={item.src}
                  className="reveal"
                  type="button"
                  onClick={() => openPhoto(item.full, item.alt)}
                >
                  <img loading="lazy" src={item.src} alt={item.alt} />
                </button>
              ))}
            </div>
          </section>

          <section className="gift-scene motion-scene" aria-labelledby="giftTitle">
            <div className="gift-note reveal">
              <span className="gift-note__seal" aria-hidden="true">
                {event.sealLetter}
              </span>
              <p className="eyebrow">{event.giftEyebrow}</p>
              <h2 id="giftTitle">{event.giftTitle}</h2>
              <p>{event.giftBody}</p>
            </div>
          </section>

          <section className="venue-scene motion-scene" id="venue" aria-labelledby="venueTitle">
            <div className="venue-scene__image" data-parallax data-parallax-speed="0.09" aria-hidden="true" />
            <div className="venue-scene__inner">
              <p className="eyebrow venue-scene__eyebrow reveal">{event.venueEyebrow}</p>
              <div className="venue-card reveal">
                <span className="venue-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" focusable="false">
                    <path
                      d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="10.2" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <h2 className="venue-card__name" id="venueTitle">
                  {event.venueName}
                </h2>
                <p className="venue-card__city">{event.venueCity}</p>
                <span className="venue-card__divider" aria-hidden="true" />
                <a
                  className="fg-btn fg-btn--solid venue-card__button"
                  href={event.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.mapsButton}
                </a>
              </div>
            </div>
          </section>

          <section className="dress-code motion-scene" id="dressCode" aria-labelledby="dressCodeTitle">
            <div className="section-heading reveal">
              <p className="eyebrow">{event.dressEyebrow}</p>
              <h2 id="dressCodeTitle">{event.dressTitle}</h2>
              <p>{event.dressLead}</p>
            </div>
            <div className="attire-gallery">
              {event.dressLooks.map((look) => (
                <figure className="attire-look reveal" key={look.key}>
                  <img loading="lazy" src={look.image} width={1200} height={1800} alt={`${look.label}: ${look.note}`} />
                  <figcaption>
                    <strong>{look.label}</strong>
                    <span>{look.note}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="rsvp motion-scene" id="rsvp" aria-labelledby="rsvpTitle" data-no-glitter="true">
            <div className="rsvp__panel reveal">
              <div className="rsvp__heading">
                <p className="eyebrow">{event.rsvpEyebrow}</p>
                <h2 id="rsvpTitle">{event.rsvpTitle}</h2>
                <p>{event.rsvpLead}</p>
              </div>
              {!rsvpDone ? (
                <form id="rsvpForm" ref={formRef} onSubmit={onRsvp} noValidate>
                  <div className="field">
                    <label htmlFor="guestName">Guest Name</label>
                    <input id="guestName" name="guestName" type="text" autoComplete="name" required maxLength={100} />
                    <small className="field-error" aria-live="polite" />
                  </div>
                  <fieldset className="field field--choice">
                    <legend>Attendance</legend>
                    <label>
                      <input type="radio" name="attendance" value="attending" required /> Joyfully attending
                    </label>
                    <label>
                      <input type="radio" name="attendance" value="not-attending" required /> Sending fairy wishes
                    </label>
                    <small className="field-error" aria-live="polite" />
                  </fieldset>
                  <div className="field">
                    <label htmlFor="attendees">Number of Attendees</label>
                    <input id="attendees" name="attendees" type="number" min={0} max={10} defaultValue={1} inputMode="numeric" required />
                    <small className="field-error" aria-live="polite" />
                  </div>
                  <div className="field">
                    <label htmlFor="contact">Contact Number</label>
                    <input id="contact" name="contact" type="tel" autoComplete="tel" inputMode="tel" placeholder="09xx xxx xxxx" required maxLength={20} />
                    <small className="field-error" aria-live="polite" />
                  </div>
                  <div className="field field--full">
                    <label htmlFor="message">{event.rsvpMessageLabel}</label>
                    <textarea id="message" name="message" rows={4} maxLength={500} placeholder="Leave a sweet birthday wish..." />
                    <small className="field-error" aria-live="polite" />
                  </div>
                  <button className="fg-btn fg-btn--solid" type="submit">
                    Send My RSVP
                  </button>
                  <p className={`form-status ${rsvpStatus.startsWith("Please") ? "is-error" : ""}`} role="status">
                    {rsvpStatus}
                  </p>
                </form>
              ) : (
                <div className="rsvp-success" tabIndex={-1}>
                  <ButterflyIcon />
                  <h3>{event.rsvpSuccessTitle}</h3>
                  <p>{event.rsvpSuccessBody}</p>
                </div>
              )}
            </div>
          </section>

          <section ref={finalSceneRef} className="final-scene motion-scene" aria-labelledby="finalTitle" tabIndex={-1}>
            <div className="final-scene__background" data-parallax data-parallax-speed="0.07" aria-hidden="true" />
            <div className="final-scene__shade" aria-hidden="true" />
            <div className="final-scene__copy reveal">
              <p className="eyebrow">{event.closingEyebrow}</p>
              <h2 id="finalTitle">{event.closingTitle}</h2>
              <p>{event.closingLead}</p>
              <strong>
                {event.dateLabel} · {event.timeLabel}
              </strong>
            </div>
            <div className="final-lanterns" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </section>
        </main>
      )}

      {opened && (
        <footer className="site-footer">
          <p>A handmade fairy garden invitation for {event.childFullName}.</p>
        </footer>
      )}

      {opened && (
        <button
          className={`music-toggle ${musicOn ? "is-on" : ""}`}
          type="button"
          aria-pressed={musicOn}
          aria-label={musicOn ? "Pause garden music" : "Play garden music"}
          onClick={() => void toggleMusic()}
        >
          {musicOn ? <Music2 /> : <Music />}
        </button>
      )}

      {opened && wand.on && (
        <div
          className="wand-fairy"
          aria-hidden="true"
          style={{ transform: `translate(${wand.x - 18}px, ${wand.y - 18}px)` }}
        >
          <img src={event.images.wand} alt="" />
        </div>
      )}

      <div className="particle-layer" id="particleLayer" ref={glitterRef} aria-hidden="true" />

      <dialog className="lightbox" ref={dialogRef} aria-label="Photo viewer" onClick={(e) => e.target === e.currentTarget && closePhoto()}>
        <button className="lightbox__close" type="button" aria-label="Close photo viewer" onClick={closePhoto}>
          ×
        </button>
        {lightbox && <img src={lightbox.src} alt={lightbox.alt} />}
      </dialog>
    </div>
  );
}
