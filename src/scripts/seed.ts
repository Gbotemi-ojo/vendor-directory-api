import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import crypto from 'crypto';

async function seedFromHTML() {
  await db.delete(vendors);
  console.log('Cleared existing vendors from the database.');

  const files = ['page1.html', 'page2.html'];
  let insertedCount = 0;
  const seenSlugs = new Set<string>();

  for (const file of files) {
    const filePath = path.join(process.cwd(), 'data', file);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    const extractedVendors: (typeof vendors.$inferInsert)[] = [];

    $('.group.relative').each((_, element) => {
      const el = $(element);
      const nameNode = el.find('a.font-semibold').first();
      const name = nameNode.text().trim();
      const rawHref = nameNode.attr('href') || '';
      
      let slug = null;
      let website = null;
      
      // Only process standard directory vendors
      if (rawHref.includes('/tools/')) {
        slug = rawHref.split('/tools/')[1]?.replace(/\/$/, '') || null;
        website = rawHref; // Save the profile link (e.g., /tools/whitefin)
      }

      const description = el.find('p.text-muted-foreground').first().text().trim() || null;

      if (name && description && slug && !seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        extractedVendors.push({
          id: crypto.randomUUID(),
          slug,
          name,
          website,
          description,
        });
      }
    });

    if (extractedVendors.length > 0) {
      await db.insert(vendors).values(extractedVendors);
      insertedCount += extractedVendors.length;
      console.log(`Inserted ${extractedVendors.length} vendors from ${file}`);
    }
  }

  console.log(`\n🎉 Seeding complete. Total unique vendors inserted: ${insertedCount}`);
  process.exit(0);
}

seedFromHTML().catch(console.error);
