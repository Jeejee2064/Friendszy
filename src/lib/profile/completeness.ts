export type ProfileCompletenessFields = {
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  age: number | null;
  gender: string | null;
};

export function isProfileComplete(profile: ProfileCompletenessFields | null) {
  if (!profile) return false;

  return Boolean(
    profile.full_name &&
      profile.avatar_url &&
      profile.city &&
      profile.age &&
      profile.gender
  );
}
