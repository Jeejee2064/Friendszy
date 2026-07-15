import type { Database } from "@/types/supabase";

export type Interest = Database["public"]["Tables"]["interests"]["Row"];

export type Gender = "homme" | "femme" | "non-binaire" | "autre";

export const GENDERS: Gender[] = ["homme", "femme", "non-binaire", "autre"];

export type ProfileFormData = {
  full_name: string;
  avatar_url: string | null;
  city: string;
  age: number | null;
  gender: Gender | null;
  bio: string;
};

export type ProfileSummary = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  gender: string | null;
};
