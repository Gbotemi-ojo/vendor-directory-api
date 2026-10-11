import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, like, or } from 'drizzle-orm';
import type { UpdateVendorInput } from '../schemas/vendor.schema.js';
import { LiveVendorDataSchema } from '../schemas/live-vendor.schema.js';

import { addExtra } from 'puppeteer-extra';
import vanillaPuppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

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

    const profileUrl = `https://cybersectools.com/tools/${encodeURIComponent(vendor.slug)}`;
    let browser;

    try {
      console.log(`[REFRESH] Launching stealth browser for ${vendor.slug}...`);
      browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-setuid-sandbox', '--no-sandbox'],
      });

      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      const response = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load live profile. HTTP Status: ${response?.status()}`);
      }

      await page.waitForSelector('main dl dt', { timeout: 15_000 });

      // Extract the updated data from the live DOM
      const extractionScript = String.raw`(() => {
        // 1. Extract Name (from the H1 tag)
        const nameNode = document.querySelector('h1');
        const name = nameNode ? nameNode.textContent.trim() : null;

        // 2. Extract Description (the paragraph right after the H1 container)
        const descNode = nameNode?.parentElement?.querySelector('p');
        const description = descNode ? descNode.textContent.trim() : null;

        // 3. Extract External Website
        function isExternalHttpLink(anchor) {
          try {
            const url = new URL(anchor.href);
            if (
              (url.protocol === 'http:' || url.protocol === 'https:') &&
              url.hostname !== 'cybersectools.com' &&
              !url.hostname.endsWith('.cybersectools.com')
            ) {
              return url.href;
            }
          } catch {
            return null;
          }
          return null;
        }

        const visitLink = Array.from(document.querySelectorAll('a[href]')).find(
          (anchor) => anchor.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'visit website',
        );

        let externalUrl = null;
        if (visitLink) {
          externalUrl = isExternalHttpLink(visitLink);
        }

        if (!externalUrl) {
          const websiteTerm = Array.from(document.querySelectorAll('dt')).find(
            (term) => term.textContent.trim().toLowerCase() === 'website',
          );
          const factsLink = websiteTerm?.nextElementSibling?.querySelector('a[href]');
          externalUrl = factsLink ? isExternalHttpLink(factsLink) : null;
        }

        return { name, description, website: externalUrl };
      })()`;
      const scrapedData = LiveVendorDataSchema.parse(await page.evaluate(extractionScript));

      if (!scrapedData.name && !scrapedData.website) {
        throw new Error('Vendor not found on live website or anti-bot triggered.');
      }

      // 4. Sanitize the URL to remove tracking metrics
      let sanitizedWebsite = scrapedData.website;
      if (sanitizedWebsite) {
        try {
          const urlObj = new URL(sanitizedWebsite);
          const trackingParams = new Set([
            'dclid', 'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid',
            'msclkid', 'oly_anon_id', 'oly_enc_id', 'rb_clickid',
            's_cid', 'vero_conv', 'vero_id', 'wickedid',
          ]);

          for (const key of Array.from(urlObj.searchParams.keys())) {
            if (key.toLowerCase().startsWith('utm_') || trackingParams.has(key.toLowerCase())) {
              urlObj.searchParams.delete(key);
            }
          }
          sanitizedWebsite = urlObj.toString();
        } catch (e) {
          // Fallback to raw string if parsing fails
        }
      }

      // Update the database with the fresh data
      await db
        .update(vendors)
        .set({
          ...(scrapedData.name && { name: scrapedData.name }),
          ...(scrapedData.description && { description: scrapedData.description }),
          ...(sanitizedWebsite && { website: sanitizedWebsite })
        })
        .where(eq(vendors.id, id));

    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return await this.getVendorById(id);
  }
}

export const vendorService = new VendorService();
