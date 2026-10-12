import crypto from 'node:crypto';
import { addExtra } from 'puppeteer-extra';
import vanillaPuppeteer, { type Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';

const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LIST_PAGES = [1, 2] as const;
const MAX_NAVIGATION_ATTEMPTS = 3;
const LIST_PAGE_DELAY_MS = 1_500;
const PROFILE_PAGE_DELAY_MS = 1_200;

interface VendorListing {
  name: string;
  slug: string;
  description: string | null;
}

async function navigateWithRetry(
  page: Page,
  url: string,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_NAVIGATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      if (!response) {
        throw new Error(`Navigation returned no response for ${url}`);
      }

      if (response.status() === 429 || response.status() >= 500) {
        if (attempt === MAX_NAVIGATION_ATTEMPTS) {
          throw new Error(`HTTP ${response.status()} after ${attempt} attempts for ${url}`);
        }
        console.warn(
          `HTTP ${response.status()} for ${url}; retrying in ${attempt * 5} seconds.`,
        );
        await delay(attempt * 5_000);
        continue;
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} while loading ${url}`);
      }

      return;
    } catch (error) {
      if (attempt === MAX_NAVIGATION_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `Navigation attempt ${attempt} failed for ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await delay(attempt * 1_000);
    }
  }
}

async function getVendorListings(
  page: Page,
  pageNumber: (typeof LIST_PAGES)[number],
  seenSlugs: Set<string>,
): Promise<VendorListing[]> {
  const url = `https://cybersectools.com/categories/ai-security?page=${pageNumber}`;
  await navigateWithRetry(page, url);

  await page.waitForSelector('main a.font-semibold[href^="/tools/"]', {
    timeout: 15_000,
  });

  const listings = (await page.evaluate(() => {
    const grids = Array.from(document.querySelectorAll('main div.grid'));
    const grid = grids.find((candidate) =>
      candidate.querySelector('a.font-semibold[href^="/tools/"]'),
    );

    if (!grid) {
      throw new Error('Could not find the main vendor grid.');
    }

    return Array.from(grid.querySelectorAll('div.rounded-lg.text-card-foreground'))
      .map((card) => {
        const nameLink = card.querySelector<HTMLAnchorElement>(
          'a.font-semibold[href^="/tools/"]',
        );
        if (!nameLink) return null;

        let ancestor: Element | null = card;
        while (ancestor) {
          if (ancestor.getAttribute('data-location')?.toLowerCase() === 'featured') {
            return null;
          }
          if (ancestor === grid) break;
          ancestor = ancestor.parentElement;
        }

        const markedFeatured = Array.from(card.querySelectorAll('[data-location]')).some(
          (element) => element.getAttribute('data-location')?.toLowerCase() === 'featured',
        );
        const hasFeaturedBadge = Array.from(
          card.querySelectorAll('span, [role="status"], [class*="badge" i]'),
        ).some(
          (element) =>
            element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() === 'featured',
        );
        if (markedFeatured || hasFeaturedBadge) return null;

        const name = nameLink.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const profileUrl = new URL(nameLink.getAttribute('href') ?? '', window.location.origin);
        const slugMatch = profileUrl.pathname.match(/^\/tools\/([^/]+)\/?$/);
        if (!name || !slugMatch) return null;

        const description =
          card
            .querySelector('p.line-clamp-2')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim() || null;

        return {
          name,
          slug: decodeURIComponent(slugMatch[1]),
          description,
        };
      })
      .filter((vendor): vendor is VendorListing => vendor !== null);
  })) as VendorListing[];

  const uniqueListings: VendorListing[] = [];
  for (const vendor of listings) {
    if (seenSlugs.has(vendor.slug)) continue;
    seenSlugs.add(vendor.slug);
    uniqueListings.push(vendor);
  }

  if (uniqueListings.length === 0) {
    throw new Error(`No standard vendor listings found on page ${pageNumber}.`);
  }

  return uniqueListings;
}

async function getExternalWebsite(
  page: Page,
  slug: string,
): Promise<string | null> {
  const profileUrl = `https://cybersectools.com/tools/${encodeURIComponent(slug)}`;
  await navigateWithRetry(page, profileUrl);
  await page.waitForSelector('main dl dt', { timeout: 15_000 });

  const website = await page.evaluate(() => {
    const visitLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
      (anchor) =>
        anchor.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() === 'visit website',
    );
    const websiteTerm = Array.from(document.querySelectorAll('dt')).find(
      (term) => term.textContent?.trim().toLowerCase() === 'website',
    );
    const factsLink =
      websiteTerm?.nextElementSibling?.querySelector<HTMLAnchorElement>('a[href]');
    const websiteCandidates = [visitLink, factsLink].filter(
      (anchor): anchor is HTMLAnchorElement => anchor !== undefined && anchor !== null,
    );

    return websiteCandidates.find((anchor) => {
      try {
        const url = new URL(anchor.href);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.hostname !== 'cybersectools.com' &&
          !url.hostname.endsWith('.cybersectools.com')
        );
      } catch {
        return false;
      }
    })?.href ?? null;
  });

  if (!website) return null;

  const sanitizedUrl = new URL(website);
  const trackingParameters = new Set([
    'dclid', 'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid',
    'msclkid', 'oly_anon_id', 'oly_enc_id', 'rb_clickid',
    's_cid', 'vero_conv', 'vero_id', 'wickedid',
  ]);

  for (const key of Array.from(sanitizedUrl.searchParams.keys())) {
    if (key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase())) {
      sanitizedUrl.searchParams.delete(key);
    }
  }

  return sanitizedUrl.toString();
}

async function seedLive(): Promise<void> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    console.log('Clearing existing vendors from the database...');
    await db.delete(vendors);
    console.log('Database cleared.');

    const seenSlugs = new Set<string>();

    console.log('Launching stealth browser to scrape AI Security vendors...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-setuid-sandbox', '--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const listings: VendorListing[] = [];
    for (const pageNumber of LIST_PAGES) {
      const pageListings = await getVendorListings(page, pageNumber, seenSlugs);
      listings.push(...pageListings);
      console.log(`Collected ${pageListings.length} vendors from page ${pageNumber}.`);
      await delay(LIST_PAGE_DELAY_MS);
    }

    console.log(`Found ${listings.length} unique standard vendors. Extracting profile URLs...`);

    const records: (typeof vendors.$inferInsert)[] = [];
    for (const [index, vendor] of listings.entries()) {
      const website = await getExternalWebsite(page, vendor.slug);
      
      records.push({
        id: crypto.randomUUID(),
        slug: vendor.slug,
        name: vendor.name,
        website,
        description: vendor.description,
      });
      
      console.log(`Fetched profile ${index + 1}/${listings.length}: ${vendor.name}.`);
      await delay(PROFILE_PAGE_DELAY_MS);
    }

    if (records.length > 0) {
      await db.insert(vendors).values(records);
    }
    console.log(`Seeding complete. Inserted ${records.length} new vendors.`);

  } finally {
    if (browser) await browser.close();
    await db.$client.end();
  }
}

seedLive().catch((error: unknown) => {
  console.error('Vendor seeding failed:', error);
  process.exitCode = 1;
});
