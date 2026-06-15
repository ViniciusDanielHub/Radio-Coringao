// src/shared/services/slugify/index.ts
import slugifyLib from 'slugify';

export function createSlug(text: string): string {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    locale: 'pt',
    trim: true,
  });
}

export async function createUniqueSlug(
  text: string,
  findFirst: (slug: string, excludeId?: string) => Promise<boolean>,
  excludeId?: string,
): Promise<string> {
  const baseSlug = createSlug(text);
  let slug = baseSlug;
  let counter = 1;

  while (await findFirst(slug, excludeId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
