// scripts/seed-test-users.js
//
// Crée en masse de faux comptes de test, réels et fonctionnels (email confirmé
// automatiquement, mot de passe connu), avec profil rempli et intérêts aléatoires.
//
// ⚠️ Utilise la clé service_role — ne JAMAIS commiter ce fichier avec une clé en dur,
// ne JAMAIS l'exécuter ailleurs qu'en local sur ta machine.
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/seed-test-users.js
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/seed-test-users.js clean
//
// (les deux valeurs sont déjà dans ton .env.local — copie-les dans la commande,
//  ou lance `set -a; source .env.local; set +a` avant pour les charger dans ton shell)

const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const TEST_DOMAIN = "friendszy.test"; // TLD réservé pour les tests, jamais de vrai envoi
const TEST_PASSWORD = "TestPassword123!";
const COUNT = parseInt(process.argv[3] || "20", 10);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY dans l'environnement.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws }, // Node 20 n'a pas de WebSocket natif, on lui en fournit un
});

const FIRST_NAMES = ["Sophie","Marc","Julie","Alex","Léa","Thomas","Nadia","Samuel","Camille","Félix","Laurie","Maxime","Chloé","Antoine","Emma","Gabriel","Rosalie","William","Justine","Olivier"];
const CITIES = ["Montréal","Québec","Laval","Gatineau","Sherbrooke","Trois-Rivières"];
const GENDERS = ["homme","femme","non-binaire"];

async function seed(count) {
  const { data: interests, error: interestsErr } = await supabase.from("interests").select("id");
  if (interestsErr || !interests?.length) {
    console.error("Impossible de charger la table interests :", interestsErr?.message);
    process.exit(1);
  }

  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const email = `test.${firstName.toLowerCase()}.${i}@${TEST_DOMAIN}`;
    const fullName = `${firstName} Test${i}`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true, // saute complètement l'envoi d'email de confirmation
      user_metadata: { full_name: fullName },
    });

    if (error) {
      console.error(`✗ ${email} — ${error.message}`);
      continue;
    }

    const userId = data.user.id;

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        city: CITIES[i % CITIES.length],
        age: 20 + (i % 40),
        gender: GENDERS[i % GENDERS.length],
        bio: `Compte de test #${i}`,
      })
      .eq("id", userId);

    if (profileErr) {
      console.error(`  ⚠ profil incomplet pour ${email} : ${profileErr.message}`);
    }

    const shuffled = [...interests].sort(() => 0.5 - Math.random()).slice(0, 3);
    const { error: interestsInsertErr } = await supabase
      .from("profile_interests")
      .insert(shuffled.map((int) => ({ profile_id: userId, interest_id: int.id })));

    if (interestsInsertErr) {
      console.error(`  ⚠ intérêts non ajoutés pour ${email} : ${interestsInsertErr.message}`);
    }

    console.log(`✓ ${email}  (${fullName}, mot de passe : ${TEST_PASSWORD})`);
  }
}

async function clean() {
  // Liste tous les users dont l'email correspond au domaine de test, page par page
  let page = 1;
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(error.message); break; }
    if (!data.users.length) break;

    const testUsers = data.users.filter((u) => u.email?.endsWith(`@${TEST_DOMAIN}`));
    for (const u of testUsers) {
      // Suppression franche (pas shouldSoftDelete) : c'est de la donnée de test jetable,
      // pas de vrais utilisateurs dont on doit préserver l'historique des autres.
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) console.error(`✗ ${u.email} — ${delErr.message}`);
      else { console.log(`✓ supprimé : ${u.email}`); deleted++; }
    }
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`Total supprimé : ${deleted}`);
}

const mode = process.argv[2];
if (mode === "clean") {
  clean().then(() => process.exit(0));
} else {
  seed(COUNT).then(() => process.exit(0));
}