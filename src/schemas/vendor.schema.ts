import { z } from 'zod';

export const UpdateVendorBodySchema = z
  .object({
    slug: z.string().nullable().optional(),
    name: z.string().optional(),
    website: z.string().url().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required to update',
  });

export const VendorIdParamSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const VendorListQuerySchema = z
  .object({
    search: z.string().optional(),
  })
  .strict();

export type UpdateVendorInput = z.infer<typeof UpdateVendorBodySchema>;
export type VendorIdParams = z.infer<typeof VendorIdParamSchema>;
export type VendorListQuery = z.infer<typeof VendorListQuerySchema>;
