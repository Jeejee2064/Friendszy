// Purely illustrative "aperçu" profiles pinned on the public (signed-out)
// landing map — shown once a visitor clicks "Découvrir", so they
// immediately understand there are *people* on Friendszy, not just events
// and activities, and are nudged toward signing up. None of this is real
// user data: no real name (first-name-plus-initial only), no real address
// (a plausible Montreal-area point, not an actual location), and the
// photos are AI-generated synthetic faces (StyleGAN2, from
// thispersondoesnotexist.com — nobody real) saved locally under
// /public/images/preview-people, not photos of any real person. Always
// rendered with an explicit disclaimer (see the person-pin popup in
// PublicLanding) and never mixed into the real event/partner pins, so it
// can't be mistaken for an actual member. Static — swap this out once real
// member profiles are worth showing instead.
//
// No real `interests` table is fetched for anonymous visitors (see
// (app)/page.tsx — the public path only loads public map points), so each
// profile's `interest` is its own small, hardcoded, bilingual tag rather
// than a reference into the DB-backed Interest type used elsewhere.
export type PreviewInterestTag = { emoji: string; fr: string; en: string };

export type PreviewProfile = {
  id: string;
  firstName: string;
  lastInitial: string;
  age: number;
  neighbourhood: string;
  latitude: number;
  longitude: number;
  /** Local static asset — see public/images/preview-people/. */
  photo: string;
  interest: PreviewInterestTag;
};

const BOARD_GAMES: PreviewInterestTag = { emoji: "🎲", fr: "Jeux de société", en: "Board games" };
const MUSIC: PreviewInterestTag = { emoji: "🎸", fr: "Musique", en: "Music" };
const READING: PreviewInterestTag = { emoji: "📚", fr: "Lecture", en: "Reading" };
const OUTDOORS: PreviewInterestTag = { emoji: "🥾", fr: "Plein air", en: "Outdoors" };
const COOKING: PreviewInterestTag = { emoji: "🍳", fr: "Cuisine", en: "Cooking" };
const MOVIES: PreviewInterestTag = { emoji: "🎬", fr: "Cinéma", en: "Movies" };
const YOGA: PreviewInterestTag = { emoji: "🧘", fr: "Yoga", en: "Yoga" };
const CYCLING: PreviewInterestTag = { emoji: "🚴", fr: "Vélo", en: "Cycling" };
const PHOTOGRAPHY: PreviewInterestTag = { emoji: "📸", fr: "Photo", en: "Photography" };
const SPORTS: PreviewInterestTag = { emoji: "⚽", fr: "Sport", en: "Sports" };

export const PREVIEW_PROFILES: PreviewProfile[] = [
  { id: "p1", firstName: "Sophie", lastInitial: "L.", age: 27, neighbourhood: "Le Plateau-Mont-Royal", latitude: 45.5185, longitude: -73.5813, photo: "/images/preview-people/p6.jpg", interest: BOARD_GAMES },
  { id: "p2", firstName: "Maxime", lastInitial: "T.", age: 31, neighbourhood: "Rosemont–La Petite-Patrie", latitude: 45.5407, longitude: -73.5793, photo: "/images/preview-people/p2.jpg", interest: MUSIC },
  { id: "p3", firstName: "Camille", lastInitial: "R.", age: 24, neighbourhood: "Verdun", latitude: 45.4589, longitude: -73.5675, photo: "/images/preview-people/p3.jpg", interest: READING },
  { id: "p4", firstName: "Olivier", lastInitial: "B.", age: 29, neighbourhood: "Villeray", latitude: 45.5443, longitude: -73.6206, photo: "/images/preview-people/p4.jpg", interest: OUTDOORS },
  { id: "p5", firstName: "Léa", lastInitial: "G.", age: 26, neighbourhood: "Hochelaga-Maisonneuve", latitude: 45.5477, longitude: -73.5385, photo: "/images/preview-people/p5.jpg", interest: COOKING },
  { id: "p6", firstName: "Samuel", lastInitial: "D.", age: 33, neighbourhood: "Mile End", latitude: 45.5227, longitude: -73.6034, photo: "/images/preview-people/p1.jpg", interest: MOVIES },
  { id: "p7", firstName: "Élodie", lastInitial: "M.", age: 25, neighbourhood: "Ahuntsic-Cartierville", latitude: 45.5591, longitude: -73.6708, photo: "/images/preview-people/p7.jpg", interest: YOGA },
  { id: "p8", firstName: "Gabriel", lastInitial: "P.", age: 30, neighbourhood: "Côte-des-Neiges", latitude: 45.4967, longitude: -73.6280, photo: "/images/preview-people/p8.jpg", interest: CYCLING },
  { id: "p9", firstName: "Rosalie", lastInitial: "F.", age: 23, neighbourhood: "Ville-Marie", latitude: 45.5048, longitude: -73.5665, photo: "/images/preview-people/p10.jpg", interest: PHOTOGRAPHY },
  { id: "p10", firstName: "Thomas", lastInitial: "N.", age: 34, neighbourhood: "Griffintown", latitude: 45.4930, longitude: -73.5620, photo: "/images/preview-people/p9.jpg", interest: SPORTS },
  { id: "p11", firstName: "Charlotte", lastInitial: "V.", age: 28, neighbourhood: "Outremont", latitude: 45.5177, longitude: -73.6100, photo: "/images/preview-people/p12.jpg", interest: BOARD_GAMES },
  { id: "p12", firstName: "Alexandre", lastInitial: "J.", age: 32, neighbourhood: "LaSalle", latitude: 45.4311, longitude: -73.6270, photo: "/images/preview-people/p11.jpg", interest: MUSIC },
  { id: "p13", firstName: "Florence", lastInitial: "C.", age: 25, neighbourhood: "Saint-Henri", latitude: 45.4770, longitude: -73.5890, photo: "/images/preview-people/p13.jpg", interest: READING },
  { id: "p14", firstName: "Nathan", lastInitial: "S.", age: 27, neighbourhood: "Notre-Dame-de-Grâce", latitude: 45.4720, longitude: -73.6220, photo: "/images/preview-people/p14.jpg", interest: OUTDOORS },
  { id: "p15", firstName: "Amélie", lastInitial: "B.", age: 29, neighbourhood: "Petite-Bourgogne", latitude: 45.4880, longitude: -73.5760, photo: "/images/preview-people/p15.jpg", interest: COOKING },
  { id: "p16", firstName: "Félix", lastInitial: "R.", age: 22, neighbourhood: "Pointe-Saint-Charles", latitude: 45.4750, longitude: -73.5680, photo: "/images/preview-people/p17.jpg", interest: MOVIES },
  { id: "p17", firstName: "Juliette", lastInitial: "H.", age: 31, neighbourhood: "Parc-Extension", latitude: 45.5350, longitude: -73.6220, photo: "/images/preview-people/p16.jpg", interest: YOGA },
  { id: "p18", firstName: "Antoine", lastInitial: "L.", age: 26, neighbourhood: "Saint-Léonard", latitude: 45.5880, longitude: -73.5990, photo: "/images/preview-people/p19.jpg", interest: CYCLING },
  { id: "p19", firstName: "Béatrice", lastInitial: "K.", age: 24, neighbourhood: "Montréal-Nord", latitude: 45.6050, longitude: -73.6250, photo: "/images/preview-people/p18.jpg", interest: PHOTOGRAPHY },
  { id: "p20", firstName: "Simon", lastInitial: "M.", age: 35, neighbourhood: "Lachine", latitude: 45.4370, longitude: -73.6690, photo: "/images/preview-people/p20.jpg", interest: SPORTS },
];
