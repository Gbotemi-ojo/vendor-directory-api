import { z } from 'zod';

export const LiveVendorDataSchema = z.object({
  name: z.string().nullable(),
  description: z.string().nullable(),
  website: z.string().url().nullable(),
});

export type LiveVendorData = z.infer<typeof LiveVendorDataSchema>;
