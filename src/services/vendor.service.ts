import { db } from '../db';
import { vendors } from '../db/schema';
import { eq, like, or } from 'drizzle-orm';
import * as cheerio from 'cheerio';

export interface UpdateVendorInput {
  name?: string;
  website?: string | null;
  description?: string | null;
}

export class VendorService {
  async getAllVendors(search?: string) {
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      return await db
        .select()
        .from(vendors)
        .where(
          or(
            like(vendors.name, searchTerm),
            like(vendors.description, searchTerm)
          )
        );
    }

    return await db.select().from(vendors);
  }

  async getVendorById(id: string) {
    const records = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);

    return records[0] || null;
  }

  async updateVendor(id: string, data: UpdateVendorInput) {
    const existing = await this.getVendorById(id);
    if (!existing) {
      return null;
    }

    await db
      .update(vendors)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.description !== undefined && { description: data.description }),
      })
      .where(eq(vendors.id, id));

    return await this.getVendorById(id);
  }

  async refreshVendor(id: string) {
    const vendor = await this.getVendorById(id);
    if (!vendor || !vendor.website) {
      throw new Error('Vendor not found or missing source URL');
    }

    // Ensure it's an absolute URL
    const sourceUrl = vendor.website.startsWith('http') 
      ? vendor.website 
      : `https://cybersectools.com${vendor.website}`;

    // Fetch the live page
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch source: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Bulletproof fallback: use meta tags since we don't know the exact page layout
    const newDescription = $('meta[name="description"]').attr('content') || vendor.description;
    
    // Extract name from the title tag (usually formats like "Tool Name - Reviews...")
    const fullTitle = $('title').text();
    const newName = fullTitle ? fullTitle.split('-')[0].trim() : vendor.name;

    // Update the database
    await db
      .update(vendors)
      .set({ 
        name: newName, 
        description: newDescription 
      })
      .where(eq(vendors.id, id));

    return await this.getVendorById(id);
  }
}

export const vendorService = new VendorService();
