export const TEST_PASSWORD = "TestPassword123!";

export const ALEX = {
  id: "cfe64006-2964-4f0b-959e-d41102911f87",
  email: "test.alex.3@friendszy.test",
  fullName: "Alex Test3",
};

export const SAMUEL = {
  id: "9131081a-fd55-447c-ad94-f3351ea3fabe",
  email: "test.samuel.7@friendszy.test",
  fullName: "Samuel Test7",
};

export const CAMILLE = {
  id: "0cd75839-a57d-4b30-abb1-3fd11a7629b4",
  email: "test.camille.8@friendszy.test",
  fullName: "Camille Test8",
};

export const ANTOINE = {
  id: "a5800ab3-2fb2-4991-9d62-d64bdc880147",
  email: "test.antoine.13@friendszy.test",
  fullName: "Antoine Test13",
};

// Not a login persona (no storageState in auth.setup.ts) — used only as a
// moderation target for admin.spec.ts, so suspend/reactivate never touches
// one of the 4 curated login personas other specs depend on.
export const SOPHIE = {
  id: "8dee63bf-4c63-4e63-91de-67edfad14fb3",
  fullName: "Sophie Test0",
};

// Disposable, one-shot accounts explicitly designated by the user for
// e2e/account-deletion.spec.ts. Never reused after that spec runs — the
// deletion is irreversible (Supabase Auth soft-delete scrambles the email).
export const JULIE = {
  id: "c4db2d07-d49f-48f3-9b0f-f53d42070ba0",
  email: "test.julie.2@friendszy.test",
  fullName: "Julie Test2",
};

export const THOMAS = {
  id: "16be2a78-7be1-4f18-91a1-684f5e274d56",
  email: "test.thomas.5@friendszy.test",
  fullName: "Thomas Test5",
};
