"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  Ban,
  Check,
  ChevronLeft,
  Flag,
  Image as ImageIcon,
  Music,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "@/components/layout/locale-toggle";

const SLIDE_COUNT = 5;
const LAST = SLIDE_COUNT - 1;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

// Every visual below is illustrative (client-confirmed: "des exemples
// seulement") — none of it reads real data, so it's aria-hidden and inert.

const AVATAR_BLUE = { backgroundColor: "#d6e8f5", color: "var(--dark)" };
const AVATAR_DARK = { backgroundColor: "#1a2e2b", color: "var(--teal1)" };
const AVATAR_TEAL = { backgroundColor: "var(--teal1)", color: "#1a2e2b" };

function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-bold text-text shadow-md ${className}`}
    >
      {children}
    </span>
  );
}

function WelcomeVisual() {
  const t = useTranslations("Welcome.interests");
  return (
    <div className="relative mx-auto h-[300px] w-[300px]" aria-hidden>
      <div className="absolute inset-x-6 top-4 h-[260px] rounded-full bg-border/70" />
      <div
        className="absolute left-5 top-9 flex h-24 w-24 items-center justify-center rounded-full border-4 border-bg text-2xl font-black"
        style={AVATAR_BLUE}
      >
        MB
      </div>
      <div
        className="absolute right-0 top-2 flex h-[104px] w-[104px] items-center justify-center rounded-full border-4 border-bg text-2xl font-black"
        style={AVATAR_DARK}
      >
        JL
      </div>
      <div
        className="absolute left-[100px] top-[130px] flex h-28 w-28 items-center justify-center rounded-full border-4 border-bg text-3xl font-black"
        style={AVATAR_TEAL}
      >
        AC
      </div>
      <Chip className="absolute left-0 top-[118px] bg-white">
        {t("pickleball")}
      </Chip>
      <Chip className="absolute right-3 top-[100px] bg-white">
        {t("improv")}
      </Chip>
      <Chip
        className="absolute bottom-3 left-4 bg-[#dcebf6] !shadow-none"
        // Soft-blue chip, same tint family as the MB avatar.
      >
        <span style={{ color: "var(--dark)" }}>{t("boardGames")}</span>
      </Chip>
      <Chip className="absolute bottom-0 right-0 bg-white">{t("hiking")}</Chip>
    </div>
  );
}

type InterestKey =
  | "cooking"
  | "pickleball"
  | "photo"
  | "climbing"
  | "boardGames"
  | "yoga"
  | "reading"
  | "hiking"
  | "museums"
  | "improv"
  | "tennis"
  | "cycling";

// Rows as laid out in the mockup.
const INTEREST_ROWS: InterestKey[][] = [
  ["cooking", "pickleball", "photo"],
  ["climbing", "boardGames"],
  ["yoga", "reading", "hiking"],
  ["museums", "improv", "tennis", "cycling"],
];

function InterestsVisual() {
  const t = useTranslations("Welcome.interests");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["pickleball", "boardGames", "hiking"]),
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {INTEREST_ROWS.map((row) => (
        <div key={row.join("-")} className="flex justify-center gap-2.5">
          {row.map((key) => {
            const on = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[15px] font-bold transition-colors ${
                  on
                    ? "border-[#1a2e2b] bg-[#1a2e2b] text-white"
                    : "border-border bg-white text-text"
                }`}
              >
                {on && (
                  <Check
                    className="h-4 w-4 text-teal1"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
                {t(key)}
              </button>
            );
          })}
        </div>
      ))}
      <span
        className="mt-1 rounded-full px-5 py-2.5 text-[15px] font-bold"
        style={{ backgroundColor: "#dcebf6", color: "var(--dark)" }}
      >
        {t("moreCategories")}
      </span>
    </div>
  );
}

function DateTile({
  day,
  num,
  style,
}: {
  day: string;
  num: number;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl leading-none"
      style={style}
    >
      <span className="text-[11px] font-extrabold tracking-wide">{day}</span>
      <span className="mt-0.5 text-xl font-black">{num}</span>
    </div>
  );
}

function EventsVisual() {
  const t = useTranslations("Welcome");
  return (
    <div
      className="relative mx-auto w-full max-w-[340px] space-y-0 py-2"
      aria-hidden
    >
      <div className="relative z-0 ml-1 mr-4 -rotate-3 rounded-3xl border border-border bg-white p-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <DateTile
            day={t("ev1.day")}
            num={18}
            style={{ backgroundColor: "#cdeeea", color: "var(--dark)" }}
          />
          <div>
            <p className="font-extrabold text-text">{t("ev1.title")}</p>
            <p className="text-sm text-muted">{t("ev1.meta")}</p>
          </div>
        </div>
      </div>
      <div className="relative z-10 -mt-2 rounded-3xl bg-[#1a2e2b] p-4 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <DateTile
            day={t("ev2.day")}
            num={16}
            style={{ backgroundColor: "#dcebf6", color: "var(--dark)" }}
          />
          <div>
            <p className="font-extrabold">{t("ev2.title")}</p>
            <p className="text-sm text-white/70">{t("ev2.meta")}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex">
            {[
              { l: "MB", s: AVATAR_BLUE },
              { l: "AC", s: AVATAR_TEAL },
              { l: "JL", s: { backgroundColor: "#eef7f5", color: "#1a2e2b" } },
            ].map((a, i) => (
              <span
                key={a.l}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1a2e2b] text-xs font-black ${
                  i > 0 ? "-ml-2" : ""
                }`}
                style={a.s}
              >
                {a.l}
              </span>
            ))}
          </div>
          <span
            className="rounded-full px-4 py-2 text-sm font-extrabold"
            style={{ backgroundColor: "var(--teal1)", color: "#1a2e2b" }}
          >
            {t("join")}
          </span>
        </div>
      </div>
      <div className="relative z-0 -mt-2 ml-8 mr-0 rotate-2 rounded-3xl border border-border bg-white p-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <DateTile
            day={t("ev3.day")}
            num={19}
            style={{ backgroundColor: "#e3f4f0", color: "var(--muted)" }}
          />
          <div>
            <p className="font-extrabold text-text">{t("ev3.title")}</p>
            <p className="text-sm text-muted">{t("ev3.meta")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscoverVisual() {
  const t = useTranslations("Welcome");
  return (
    <div className="mx-auto w-full max-w-[340px] space-y-2.5" aria-hidden>
      <div className="flex rounded-full bg-white p-1 text-sm font-extrabold text-muted">
        <span
          className="flex-1 rounded-full py-2 text-center text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("tabAll")}
        </span>
        <span className="flex-1 py-2 text-center">{t("tabEvents")}</span>
        <span className="flex-1 py-2 text-center">{t("tabActivities")}</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm text-muted">
        <Search className="h-4 w-4 text-teal2" aria-hidden />
        <span className="truncate">{t("searchPlaceholder")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            {
              k: "disc1",
              bg: "linear-gradient(160deg,#1a3a3a,#0d5f8a)",
              Icon: ImageIcon,
              c: "var(--teal1)",
            },
            {
              k: "disc2",
              bg: "linear-gradient(160deg,#1ab8c0,#1a90c8)",
              Icon: Music,
              c: "#fff",
            },
          ] as const
        ).map(({ k, bg, Icon, c }) => (
          <div
            key={k}
            className="overflow-hidden rounded-2xl border border-border bg-white"
          >
            <div
              className="relative flex h-[72px] items-center justify-center"
              style={{ background: bg }}
            >
              <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {t(`${k}.date`)}
              </span>
              <Icon
                className="mt-3 h-8 w-8"
                style={{ color: c }}
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <div className="p-2.5 leading-snug">
              <p className="text-sm font-black text-text">{t(`${k}.title`)}</p>
              <p className="text-xs text-muted">{t(`${k}.category`)}</p>
              <p className="text-xs text-muted">{t(`${k}.place`)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-3">
        <div>
          <span
            className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black tracking-wide"
            style={{ backgroundColor: "#cdeeea", color: "var(--dark)" }}
          >
            {t("openNow")}
          </span>
          <p className="mt-1.5 font-black text-text">{t("shopName")}</p>
          <p className="text-xs text-muted">{t("shopMeta")}</p>
        </div>
        <div className="flex gap-1.5">
          {[t("call"), t("website")].map((l) => (
            <span
              key={l}
              className="whitespace-nowrap rounded-full border border-teal2 px-2.5 py-1.5 text-xs font-extrabold"
              style={{ color: "var(--dark)" }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SafetyVisual() {
  return (
    <div
      className="mx-auto flex h-[112px] w-[112px] items-center justify-center rounded-full bg-border/70"
      aria-hidden
    >
      <ShieldCheck className="h-12 w-12 text-teal2" strokeWidth={1.75} />
    </div>
  );
}

function SafetyRules() {
  const t = useTranslations("Welcome");
  const rows = [
    { Icon: Ban, color: "var(--dark)", title: t("rule1"), sub: null },
    {
      Icon: Flag,
      color: "var(--teal2)",
      title: t("rule2"),
      sub: t("rule2Sub"),
    },
    { Icon: UserRound, color: "var(--teal2)", title: t("rule3"), sub: null },
  ];
  return (
    <ul className="mt-5 space-y-2.5">
      {rows.map(({ Icon, color, title, sub }) => (
        <li
          key={title}
          className="flex items-center gap-4 rounded-full border border-border bg-white px-5 py-3.5"
        >
          <Icon
            className="h-6 w-6 shrink-0"
            style={{ color }}
            strokeWidth={2}
            aria-hidden
          />
          <div className="leading-tight">
            <p className="font-extrabold text-text">{title}</p>
            {sub && <p className="text-sm text-muted">{sub}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

export function WelcomeCarousel() {
  const t = useTranslations("Welcome");
  const [[index, direction], setPage] = useState<[number, number]>([0, 1]);

  const go = (to: number) => {
    const clamped = Math.max(0, Math.min(LAST, to));
    if (clamped === index) return;
    setPage([clamped, clamped > index ? 1 : -1]);
  };

  // Reaching the last screen (by swiping, "Suivant" or "Passer") counts as
  // having seen the intro: stops proxy.ts from redirecting "/" here again.
  useEffect(() => {
    if (index !== LAST) return;
    fetch("/api/welcome-seen", { method: "POST" }).catch(() => {
      // Worst case the intro shows once more next visit — not worth surfacing.
    });
  }, [index]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY)
      go(index + 1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY)
      go(index - 1);
  }

  const titleClass =
    "text-[2rem] font-black leading-[1.05] tracking-tight text-text";
  const bodyClass = "mt-3 text-lg leading-relaxed text-muted";

  let visual: ReactNode;
  let text: ReactNode;
  switch (index) {
    case 0:
      visual = <WelcomeVisual />;
      text = (
        <>
          <h1 className={titleClass}>{t("s1Title")}</h1>
          <p className={bodyClass}>{t("s1Body")}</p>
        </>
      );
      break;
    case 1:
      visual = <InterestsVisual />;
      text = (
        <>
          <h1 className={titleClass}>{t("s2Title")}</h1>
          <p className={bodyClass}>{t("s2Body")}</p>
        </>
      );
      break;
    case 2:
      visual = <EventsVisual />;
      // No title on this screen in the mockup — body copy only.
      text = (
        <p className="text-lg leading-relaxed text-muted">{t("s3Body")}</p>
      );
      break;
    case 3:
      visual = <DiscoverVisual />;
      text = (
        <>
          <h1 className={titleClass}>{t("s4Title")}</h1>
          <p className={bodyClass}>{t("s4Body")}</p>
        </>
      );
      break;
    default:
      visual = <SafetyVisual />;
      text = (
        <>
          <h1 className={titleClass}>{t("s5Title")}</h1>
          <p className={bodyClass}>{t("s5Body")}</p>
          <SafetyRules />
        </>
      );
  }

  const ctaClass =
    "block w-full rounded-full py-4 text-center text-lg font-extrabold text-white shadow-md transition-opacity hover:opacity-95";

  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-8">
        <header className="flex h-12 items-center justify-between">
          {index === 0 ? (
            <>
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192.png"
                  alt=""
                  className="h-9 w-9 rounded-xl"
                />
                <span className="font-pacifico text-2xl text-text">
                  friendszy
                </span>
              </div>
              <LocaleToggle alwaysExpanded />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={t("back")}
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-text"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(LAST)}
                className={`text-base font-bold text-muted ${index === LAST ? "invisible" : ""}`}
                tabIndex={index === LAST ? -1 : 0}
              >
                {t("skip")}
              </button>
            </>
          )}
        </header>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={index}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={onDragEnd}
              className="flex flex-1 touch-pan-y flex-col"
            >
              <div className="flex flex-1 items-center justify-center py-4">
                {visual}
              </div>
              <div className="pb-4">{text}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="flex items-center justify-center gap-2.5 py-4"
          role="group"
          aria-label={t("slideLabel", {
            current: index + 1,
            total: SLIDE_COUNT,
          })}
        >
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={t("dotLabel", { n: i + 1 })}
              aria-current={i === index}
              className={`h-3 rounded-full transition-all ${
                i === index ? "w-10 bg-[#1a2e2b]" : "w-3 bg-teal2"
              }`}
            />
          ))}
        </div>

        {index === 0 && (
          <>
            <button
              type="button"
              onClick={() => go(1)}
              className={ctaClass}
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("start")}
            </button>
            <Link
              href="/login"
              className="mt-4 block text-center text-lg font-bold text-text"
            >
              {t("haveAccount")}
            </Link>
          </>
        )}
        {index > 0 && index < LAST && (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className={ctaClass}
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("next")}
          </button>
        )}
        {index === LAST && (
          <>
            <Link
              href={{ pathname: "/login", query: { mode: "signUp" } }}
              className={ctaClass}
              style={{ backgroundImage: "var(--grad)" }}
            >
              {t("createAccount")}
            </Link>
            <Link
              href="/login"
              className="mt-4 block text-center text-lg font-bold text-text"
            >
              {t("haveAccount")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
