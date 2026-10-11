import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, like, or, sql } from 'drizzle-orm';
import type { UpdateVendorInput } from '../schemas/vendor.schema.js';
import { refreshQueue } from '../queues/refresh.queue.js';

export class VendorService {
  async getAllVendors(search: string | undefined, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const searchTerm = search?.trim();
    const conditions = searchTerm
      ? or(
          like(vendors.name, `%${searchTerm}%`),
          like(vendors.description, `%${searchTerm}%`),
        )
      : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(vendors)
        .where(conditions)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(vendors)
        .where(conditions),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorById(id: string) {
    const records = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);
    return records[0] ?? null;
  }

  async updateVendor(id: string, data: UpdateVendorInput) {
    const existing = await this.getVendorById(id);
    if (!existing) {
      return null;
    }

    await db
      .update(vendors)
      .set({
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.description !== undefined && { description: data.description }),
      })
      .where(eq(vendors.id, id));

    return await this.getVendorById(id);
  }

  async refreshVendor(id: string) {
    const vendor = await this.getVendorById(id);

    if (!vendor) throw new Error('Vendor not found');
    if (!vendor.slug) throw new Error('Vendor is missing a slug identifier. Cannot refresh.');

    const job = await refreshQueue.add(
      'refresh-vendor',
      { vendorId: vendor.id },
      { jobId: `refresh-${vendor.id}-${Date.now()}` },
    );
    if (!job.id) {
      throw new Error(`Refresh job for vendor ${vendor.id} was created without an ID.`);
    }
    return { jobId: job.id };
  }
}

export const vendorService = new VendorService();
