import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import crypto from 'crypto';

async function seedFromHTML() {
  const files = ['page1.html', 'page2.html'];
  let insertedCount = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), 'data', file);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file} - file not found in /data folder.`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    const extractedVendors: (typeof vendors.$inferInsert)[] = [];

    $('.group.relative').each((_, element) => {
      const nameNode = $(element).find('a.font-semibold').first();
      const name = nameNode.text().trim();
      const website = nameNode.attr('href') || null;

      const description = $(element).find('p.text-muted-foreground').first().text().trim() || null;

      if (name && description) {
        extractedVendors.push({
          id: crypto.randomUUID(),
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

  console.log(`\n✅ Seeding complete. Total vendors inserted: ${insertedCount}`);
  process.exit(0);
}

seedFromHTML().catch(console.error);
