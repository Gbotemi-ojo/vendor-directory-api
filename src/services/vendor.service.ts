import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, like, or } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export interface UpdateVendorInput {
  slug?: string | null;
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

    const files = ['page1.html', 'page2.html'];
    let found = false;
    let newName = vendor.name;
    let newDescription = vendor.description;
    let newWebsite = vendor.website;

    for (const file of files) {
      const filePath = path.join(process.cwd(), 'data', file);
      if (!fs.existsSync(filePath)) continue;

      const html = fs.readFileSync(filePath, 'utf-8');
      const $ = cheerio.load(html);

      $('.group.relative').each((_, element) => {
        const el = $(element);
        const nameNode = el.find('a.font-semibold').first();
        const rawHref = nameNode.attr('href') || '';
        
        let currentSlug = null;
        let currentWebsite = null;
        
        // Only process standard directory vendors
        if (rawHref.includes('/tools/')) {
          currentSlug = rawHref.split('/tools/')[1]?.replace(/\/$/, '') || null;
          currentWebsite = rawHref; // Save the profile link
        }

        // If we found the vendor we are trying to refresh
        if (currentSlug === vendor.slug) {
          const extractedName = nameNode.text().trim();
          const extractedDesc = el.find('p.text-muted-foreground').first().text().trim();
          
          if (extractedName) newName = extractedName;
          if (extractedDesc) newDescription = extractedDesc;
          if (currentWebsite) newWebsite = currentWebsite;
          
          found = true;
          return false; // Break Cheerio loop
        }
      });

      if (found) break; // Stop searching other files once found
    }

    if (!found) throw new Error('Vendor not found in local HTML data files using slug.');

    await db
      .update(vendors)
      .set({ name: newName, description: newDescription, website: newWebsite })
      .where(eq(vendors.id, id));

    return await this.getVendorById(id);
  }
}

export const vendorService = new VendorService();
