export const TEST_PASSWORD = "TestPassword123!";

export const ALEX = {
  id: "625c732a-b3eb-46b7-b1eb-10a6eaf88e47",
  email: "test.alex.3@friendszy.test",
  fullName: "Alex Test3",
};

export const SAMUEL = {
  id: "03392869-b267-42c2-939a-469a32f2aba5",
  email: "test.samuel.7@friendszy.test",
  fullName: "Samuel Test7",
};

export const CAMILLE = {
  id: "ed6c61c1-82e6-4751-a263-a9625bde29fa",
  email: "test.camille.8@friendszy.test",
  fullName: "Camille Test8",
};

export const ANTOINE = {
  id: "e9fefef2-3410-4f04-a463-5e2d7f75ff97",
  email: "test.antoine.13@friendszy.test",
  fullName: "Antoine Test13",
};

// Not a login persona — used only as a moderation target for admin.spec.ts,
// picked from the bulk-seeded pool so suspend/reactivate never touches one
// of the 4 curated personas other specs depend on.
export const SOPHIE = {
  id: "a6028506-8891-4c07-820e-50cd997b18c7",
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
