/**
 * Écrit à la main à partir de la migration SQL (Phase 1) — à remplacer par
 * `npm run supabase:types` dès que possible pour rester la source de vérité.
 * Les colonnes texte contraintes par un CHECK (ex: `gender`, `plan`,
 * `moderation_status`) restent typées `string` : Postgres ne les expose pas
 * comme de vrais enums, donc c'est aussi ce que produirait le générateur.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          city: string | null;
          age: number | null;
          gender: string | null;
          locale: string;
          plan: string;
          plan_valid_until: string | null;
          moderation_status: string;
          is_admin: boolean;
          is_online: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          city?: string | null;
          age?: number | null;
          gender?: string | null;
          locale?: string;
          plan?: string;
          plan_valid_until?: string | null;
          moderation_status?: string;
          is_admin?: boolean;
          is_online?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      interests: {
        Row: {
          id: number;
          slug: string;
          label_fr: string;
          label_en: string;
          category: string | null;
          emoji: string | null;
        };
        Insert: {
          id?: number;
          slug: string;
          label_fr: string;
          label_en: string;
          category?: string | null;
          emoji?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["interests"]["Insert"]>;
        Relationships: [];
      };
      profile_interests: {
        Row: {
          profile_id: string;
          interest_id: number;
        };
        Insert: {
          profile_id: string;
          interest_id: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["profile_interests"]["Insert"]
        >;
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: string;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["friendships"]["Insert"]>;
        Relationships: [];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          created_at: string;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          created_at?: string;
          last_message_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["conversations"]["Insert"]
        >;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          read_at: string | null;
          delivered_at: string | null;
          removed_at: string | null;
          removed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string | null;
          read_at?: string | null;
          delivered_at?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: string;
          target_id: string;
          reason: string | null;
          status: string;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          target_type: string;
          target_id: string;
          reason?: string | null;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          payload: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          payload?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notifications"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_blocked_between: {
        Args: { a: string; b: string };
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: { conv_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_active_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_blocked_profiles: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          city: string | null;
        }[];
      };
      match_city_ids: {
        Args: { p_city: string };
        Returns: { id: string }[];
      };
    };
    Enums: Record<string, never>;
  };
};
