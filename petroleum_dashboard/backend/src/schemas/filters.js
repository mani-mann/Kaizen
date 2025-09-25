import { z } from 'zod';

export const FiltersSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  siteIds: z
    .union([
      z.array(z.coerce.number()),
      z.string().transform((s) => s.split(',').filter(Boolean).map(Number)),
    ])
    .optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
  includeShop: z
    .union([z.string().transform((v) => v === 'true'), z.boolean()])
    .default(true),
});

export function parseFilters(q) {
  const parsed = FiltersSchema.safeParse(q);
  if (!parsed.success) {
    return { granularity: 'day', includeShop: true };
  }
  return parsed.data;
}

