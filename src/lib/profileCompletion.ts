export interface ProfileLike {
  full_name?: string | null;
  call_number?: string | null;
  whatsapp_number?: string | null;
  country?: string | null;
  profile_image?: string | null;
}

/**
 * Required profile fields for marketplace participation.
 * Mirrors current rules: name + phone + whatsapp + country.
 */
export const REQUIRED_FIELDS: (keyof ProfileLike)[] = [
  'full_name',
  'call_number',
  'whatsapp_number',
  'country',
];

export const OPTIONAL_FIELDS: (keyof ProfileLike)[] = ['profile_image'];

export function isProfileComplete(profile?: ProfileLike | null): boolean {
  if (!profile) return false;
  return REQUIRED_FIELDS.every(f => {
    const v = profile[f];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

export function profileCompletionPercent(profile?: ProfileLike | null): number {
  if (!profile) return 0;
  const all = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
  const filled = all.filter(f => {
    const v = profile[f];
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
  return Math.round((filled / all.length) * 100);
}

export function missingProfileFields(profile?: ProfileLike | null): string[] {
  if (!profile) return REQUIRED_FIELDS as string[];
  return REQUIRED_FIELDS.filter(f => {
    const v = profile[f];
    return !(typeof v === 'string' && v.trim().length > 0);
  }) as string[];
}