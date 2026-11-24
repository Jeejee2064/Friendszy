// Squelettes de chargement, un par écran, calqués sur la vraie mise en page :
// mêmes conteneurs, mêmes marges, mêmes hauteurs de lignes, mêmes grilles.
// Règles suivies :
//  - les textes statiques (titres de page) sont affichés pour de vrai, seuls
//    les contenus qui dépendent des données sont squelettisés ;
//  - les dimensions reprennent celles des composants réels (PageHeader,
//    TabButton, GroupCard, EventCard, PersonCard…) pour que le contenu
//    remplace le placeholder sans aucun saut de mise en page ;
//  - les écrans qu'on ne peut pas décrire fidèlement (admin, assistants de
//    création, formulaires d'édition) n'ont PAS de faux squelette : juste une
//    fine barre de progression (RouteProgress).

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton, SkeletonAvatar } from "./skeleton";
import { MessagesOpenSkeleton } from "./messages-open-skeleton";

/* ---------------------------------------------------------------- briques */

async function Shell({ children, className = "" }: { children: ReactNode; className?: string }) {
  const t = await getTranslations("Common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}

/** Même gabarit que <PageHeader> (px-6 py-4, h1 28 px / 32 px dès md). */
function PageHeaderSkeleton({ title, back = false }: { title?: string; back?: boolean }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 py-4 md:px-10">
      <div className="flex min-w-0 items-center gap-3">
        {back && <Skeleton className="h-12 w-12 shrink-0 rounded-full" />}
        {title ? (
          <h1 className="truncate text-xl font-extrabold text-text md:text-2xl">{title}</h1>
        ) : (
          <Skeleton className="h-7 w-44 rounded-lg md:h-8" />
        )}
      </div>
    </header>
  );
}

/** Titre nu des pages qui n'utilisent pas PageHeader (h1 text-2xl). */
function PageTitle({ title, className = "mb-6" }: { title: string; className?: string }) {
  return <h1 className={`${className} text-2xl font-extrabold text-text`}>{title}</h1>;
}

/** Barre d'onglets en pastilles (TabButton : min-h-11 dans un conteneur p-1). */
function PillTabsSkeleton({ count, className = "mb-6" }: { count: number; className?: string }) {
  return (
    <div className={`${className} flex gap-2 rounded-full bg-card p-1`}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-11 min-w-0 flex-1 rounded-full" />
      ))}
    </div>
  );
}

function ChipSkeleton({ width }: { width: string }) {
  return <Skeleton className={`h-6 rounded-full ${width}`} />;
}

function Grid3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/* ----------------------------------------------------------------- cartes */

/** EventCard / PartnerCard : visuel h-40 puis corps p-4. */
function MediaCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-[19px] w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <div className="mt-1 flex gap-2">
          <ChipSkeleton width="w-24" />
          <ChipSkeleton width="w-16" />
        </div>
      </div>
    </div>
  );
}

/** PersonCard : avatar 56 px, nom, ville, puces d'intérêts communs. */
function PersonCardSkeleton({ footer = "none" }: { footer?: "none" | "button" | "friend" }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <SkeletonAvatar size="h-14 w-14" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <div className="flex gap-2 pt-0.5">
            <ChipSkeleton width="w-16" />
            <ChipSkeleton width="w-20" />
          </div>
        </div>
      </div>
      {footer !== "none" && <Skeleton className="h-9 w-full rounded-full" />}
      {footer === "friend" && (
        <div className="flex items-center justify-end gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}

/** GroupCard : avatar, nom, description, puce + effectif, bouton « demander ». */
function GroupCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-4">
        <SkeletonAvatar size="h-14 w-14" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
          <div className="flex items-center gap-2 pt-0.5">
            <ChipSkeleton width="w-24" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        </div>
      </div>
      <Skeleton className="h-[38px] w-full rounded-full" />
    </div>
  );
}

/** Ligne de conversation / de groupe dans une liste (avatar + 2 lignes). */
function ListRowSkeleton({ bordered = false }: { bordered?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 p-4 ${
        bordered ? "rounded-2xl border border-border bg-card" : ""
      }`}
    >
      <SkeletonAvatar size="h-12 w-12" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-8 rounded-md" />
        </div>
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- écrans */

/** Accueil : bandeau de bienvenue, 3 stats, accès rapide (6 cartes), activité. */
export async function HomeSkeleton() {
  const tNav = await getTranslations("Nav");
  return (
    <Shell className="flex flex-col">
      <PageHeaderSkeleton title={tNav("home")} />
      <div className="p-6 md:p-10">
        <Skeleton className="mb-6 h-[76px] w-full rounded-2xl" />

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-2xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="mb-3 h-4 w-28 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <SkeletonAvatar size="h-10 w-10" />
                  <div className="flex h-11 min-w-0 flex-1 flex-col justify-between py-0.5">
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <Skeleton className="h-3.5 w-3/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Skeleton className="mb-3 h-4 w-32 rounded-md" />
            <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <SkeletonAvatar size="h-10 w-10" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-full rounded-md" />
                    <Skeleton className="h-3.5 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Découvrir : titre, filtres, puis sections Évènements / Activités en grille. */
export async function DiscoverSkeleton() {
  const t = await getTranslations("Discover");
  return (
    <Shell className="p-6 md:p-10">
      <PageTitle title={t("title")} />
      <PillTabsSkeleton count={3} />
      <div className="mb-6 h-10 w-full rounded-full border border-border bg-card" />
      <div className="mb-6 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="min-w-[220px] flex-1 space-y-1.5">
            <Skeleton className="h-4 w-20 rounded-md" />
            <div className="h-[42px] w-full rounded-lg border border-border bg-bg" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-6 h-9 w-36 rounded-full" />

      <div className="flex flex-col gap-8">
        {[t("sectionEvents"), t("sectionPartners")].map((title) => (
          <section key={title}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-text">{title}</h2>
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
            <Grid3>
              {Array.from({ length: 3 }, (_, i) => (
                <MediaCardSkeleton key={i} />
              ))}
            </Grid3>
          </section>
        ))}
      </div>
    </Shell>
  );
}

/** Groupes : titre + bouton, onglets, panneau de filtres, grille de groupes. */
export async function GroupsSkeleton() {
  const t = await getTranslations("Groups");
  return (
    <Shell className="overflow-x-hidden p-4 md:p-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <Skeleton className="h-9 w-10 shrink-0 rounded-full sm:w-40" />
      </div>
      <PillTabsSkeleton count={2} />
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="mb-3 flex gap-4 border-b border-border pb-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-5 flex-1 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-[42px] w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Cercle d'amis : titre, onglets soulignés, filtre, grille de personnes. */
export async function FriendsSkeleton() {
  const t = await getTranslations("Friends");
  return (
    <Shell className="p-6 md:p-10">
      <PageTitle title={t("title")} />
      <div className="mb-6 flex gap-3 border-b border-border pb-3">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-[42px] w-full rounded-lg border border-border bg-card md:max-w-xs" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <PersonCardSkeleton key={i} footer="friend" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Rechercher : titre, 3 onglets, puis la 1re étape de l'assistant (ville). */
export async function SearchSkeleton() {
  const t = await getTranslations("Search");
  return (
    <Shell className="p-6 md:p-10">
      <PageTitle title={t("title")} />
      <PillTabsSkeleton count={3} />
      <div className="max-w-md">
        <h2 className="mb-3 text-lg font-bold text-text">{t("cityStepTitle")}</h2>
        <div className="h-[42px] w-full rounded-lg border border-border bg-card" />
        <Skeleton className="mt-5 h-11 w-full rounded-full" />
      </div>
    </Shell>
  );
}

/** Notifications : en-tête puis un panneau de lignes de notification. */
export async function NotificationsSkeleton() {
  const t = await getTranslations("Notifications");
  return (
    <Shell className="flex flex-col">
      <PageHeaderSkeleton title={t("title")} />
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <SkeletonAvatar size="h-10 w-10" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Paramètres : titre puis cartes de sections (rounded-2xl p-6). */
export async function SettingsSkeleton() {
  const t = await getTranslations("Settings");
  return (
    <Shell className="p-6 md:p-10">
      <PageTitle title={t("title")} />
      <div className="flex max-w-sm flex-col gap-4">
        {[3, 2, 2, 3].map((lines, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <Skeleton className="h-5 w-40 rounded-md" />
            {Array.from({ length: lines }, (_, j) => (
              <Skeleton key={j} className={`h-4 rounded-md ${j === lines - 1 ? "w-2/3" : "w-full"}`} />
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Mon profil : titre, onglets collants, carte d'infos (max-w-sm, avatar + champs). */
export async function ProfileEditSkeleton() {
  const t = await getTranslations("Profile");
  return (
    <Shell className="p-6 md:p-10">
      <PageTitle title={t("title")} className="mb-4" />
      <div className="mb-4 pb-3 pt-1">
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 min-w-0 flex-1 rounded-full" />
          ))}
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <SkeletonAvatar size="h-24 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="w-full space-y-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-[42px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Profil d'un autre membre : en-tête, carte centrée max-w-lg. */
export async function PublicProfileSkeleton() {
  return (
    <Shell className="flex flex-col">
      <PageHeaderSkeleton />
      <div className="p-6 md:p-10">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8">
          <SkeletonAvatar size="h-24 w-24" />
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["w-20", "w-28", "w-24", "w-32", "w-16", "w-28"].map((w, i) => (
              <Skeleton key={i} className={`h-[34px] rounded-full ${w}`} />
            ))}
          </div>
          <div className="mt-2 flex w-full gap-2">
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Messagerie : en-tête, liste de conversations (lg : + volet vide à droite). */
export async function MessagesSkeleton() {
  const t = await getTranslations("Messages");
  return (
    <Shell className="flex h-dvh flex-col">
      <PageHeaderSkeleton title={t("title")} />
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 md:p-6">
        <div className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:w-80">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-bold text-text">{t("conversationsTitle")}</h2>
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-[38px] w-full rounded-lg" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 8 }, (_, i) => (
              <ListRowSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="hidden min-h-0 min-w-0 flex-1 rounded-2xl border border-border bg-card lg:block" />
      </div>
      <MessagesOpenSkeleton />
    </Shell>
  );
}

/** Groupe (chat) : carte plein écran — en-tête, onglets, fil de messages, saisie. */
export async function GroupChatSkeleton() {
  return (
    <Shell className="flex h-dvh flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-start gap-3 border-b border-border p-4 sm:gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <SkeletonAvatar size="h-11 w-11 sm:h-14 sm:w-14" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-56 max-w-full rounded-md" />
            </div>
          </div>
          <div className="flex gap-2 border-b border-border px-3 py-2 sm:px-4">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden p-4">
            <Skeleton className="h-10 w-2/3 max-w-sm rounded-2xl rounded-bl-md" />
            <Skeleton className="ml-auto h-10 w-1/2 max-w-xs rounded-2xl rounded-br-md" />
            <Skeleton className="h-14 w-3/5 max-w-md rounded-2xl rounded-bl-md" />
            <Skeleton className="ml-auto h-10 w-2/5 max-w-[16rem] rounded-2xl rounded-br-md" />
          </div>
          <div className="border-t border-border p-3">
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Évènement : en-tête avec retour, photos + carte d'infos, colonne d'actions. */
export async function EventDetailSkeleton() {
  return (
    <Shell className="flex flex-col">
      <PageHeaderSkeleton back />
      <div className="grid min-w-0 gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-40 w-56 shrink-0 rounded-2xl" />
            <Skeleton className="h-40 w-56 shrink-0 rounded-2xl" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex gap-2">
              <ChipSkeleton width="w-24" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-1/2 rounded-md" />
              <Skeleton className="h-5 w-2/5 rounded-md" />
              <Skeleton className="h-5 w-1/3 rounded-md" />
            </div>
            <Skeleton className="mt-4 h-10 w-40 rounded-full" />
          </div>
        </div>
        <div className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Activité partenaire : en-tête avec retour, photos, carte unique. */
export async function PartnerDetailSkeleton() {
  return (
    <Shell className="flex flex-col">
      <PageHeaderSkeleton back />
      <div className="flex flex-col gap-5 p-6 md:p-10">
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-40 w-56 shrink-0 rounded-2xl" />
          <Skeleton className="h-40 w-56 shrink-0 rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex gap-2">
            <ChipSkeleton width="w-24" />
            <ChipSkeleton width="w-20" />
          </div>
          <Skeleton className="mt-3 h-4 w-1/3 rounded-md" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-5 w-2/5 rounded-md" />
            <Skeleton className="h-5 w-1/3 rounded-md" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Fine barre de progression en haut de l'écran, pour toutes les routes dont la
 * mise en page ne se prête pas à un squelette fidèle (admin, assistants de
 * création, formulaires d'édition) : mieux vaut ne rien promettre qu'un faux
 * décor qui saute au chargement.
 */
export async function RouteProgress() {
  const t = await getTranslations("Common");
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden">
        <div className="route-progress-bar h-full w-2/5 rounded-full" />
      </div>
    </div>
  );
}
