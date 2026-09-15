import type { Database } from "@/types/supabase";

export type FeedbackCategory = "bug" | "idea" | "other";
export type FeedbackStatus = "new" | "read" | "resolved";

type BetaFeedbackRow = Database["public"]["Tables"]["beta_feedback"]["Row"];

// Postgrest's introspection only sees `category`/`status` as plain `string`
// (the literal unions live in the table's CHECK constraints, not something
// generated types can express) — narrowed here to the two unions above.
export type BetaFeedback = Omit<BetaFeedbackRow, "category" | "status"> & {
  category: FeedbackCategory;
  status: FeedbackStatus;
};
