import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, like, or } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

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

    const files = ['page1.html', 'page2.html'];
    let found = false;
    let newName = vendor.name;
    let newDescription = vendor.description;

    // Search through local HTML files to find the matching vendor
    for (const file of files) {
      const filePath = path.join(process.cwd(), 'data', file);
      
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const html = fs.readFileSync(filePath, 'utf-8');
      const $ = cheerio.load(html);

      // Find the anchor tag that matches the vendor's website
      const linkElement = $(`a[href="${vendor.website}"]`);

      if (linkElement.length > 0) {
        // Find the parent container to extract the associated name and description
        const parentGroup = linkElement.closest('.group.relative');
        
        if (parentGroup.length > 0) {
          const extractedName = parentGroup.find('a.font-semibold').first().text().trim();
          const extractedDesc = parentGroup.find('p.text-muted-foreground').first().text().trim();
          
          if (extractedName) newName = extractedName;
          if (extractedDesc) newDescription = extractedDesc;
          found = true;
          break; // Stop searching once the vendor is found
        }
      }
    }

    if (!found) {
      throw new Error('Vendor not found in local HTML data files.');
    }

    await db
      .update(vendors)
      .set({
        name: newName,
        description: newDescription,
      })
      .where(eq(vendors.id, id));

    return await this.getVendorById(id);
  }
}

export const vendorService = new VendorService();
