import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { addExtra } from 'puppeteer-extra';
import vanillaPuppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { db } from './db/index.js';
import { vendors } from './db/schema.js';
import { LiveVendorDataSchema } from './schemas/live-vendor.schema.js';

interface RefreshVendorJob {
  vendorId: string;
}

const queueName = 'vendor-refresh';
const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

const extractionScript = String.raw`(() => {
  const nameNode = document.querySelector('h1');
  const name = nameNode ? nameNode.textContent.trim() : null;
  const descNode = nameNode?.parentElement?.querySelector('p');
  const description = descNode ? descNode.textContent.trim() : null;

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

  let website = visitLink ? isExternalHttpLink(visitLink) : null;
  if (!website) {
    const websiteTerm = Array.from(document.querySelectorAll('dt')).find(
      (term) => term.textContent.trim().toLowerCase() === 'website',
    );
    const factsLink = websiteTerm?.nextElementSibling?.querySelector('a[href]');
    website = factsLink ? isExternalHttpLink(factsLink) : null;
  }

  return { name, description, website };
})()`;

function sanitizeWebsite(website: string | null): string | null {
  if (!website) return null;

  const url = new URL(website);
  const trackingParameters = new Set([
    'dclid',
    'fbclid',
    'gclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'msclkid',
    'oly_anon_id',
    'oly_enc_id',
    'rb_clickid',
    's_cid',
    'vero_conv',
    'vero_id',
    'wickedid',
  ]);

  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

async function refreshVendor(job: Job<RefreshVendorJob>): Promise<void> {
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, job.data.vendorId))
    .limit(1);

  if (!vendor) {
    throw new Error(`Vendor ${job.data.vendorId} was not found.`);
  }
  if (!vendor.slug) {
    throw new Error(`Vendor ${vendor.id} is missing a slug identifier.`);
  }

  const profileUrl = `https://cybersectools.com/tools/${encodeURIComponent(vendor.slug)}`;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    console.log(`[WORKER] Refreshing ${vendor.slug} (job ${job.id})...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-setuid-sandbox', '--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    const response = await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load live profile. HTTP status: ${response?.status()}`);
    }

    await page.waitForSelector('main dl dt', { timeout: 15_000 });
    const scrapedData = LiveVendorDataSchema.parse(await page.evaluate(extractionScript));
    if (!scrapedData.name && !scrapedData.website) {
      throw new Error('Vendor data was not found on the live profile.');
    }

    const website = sanitizeWebsite(scrapedData.website);
    await db
      .update(vendors)
      .set({
        ...(scrapedData.name && { name: scrapedData.name }),
        ...(scrapedData.description && { description: scrapedData.description }),
        ...(website && { website }),
      })
      .where(eq(vendors.id, vendor.id));

    console.log(`[WORKER] Refreshed ${vendor.slug} (job ${job.id}).`);
  } finally {
    if (browser) await browser.close();
  }
}

const worker = new Worker<RefreshVendorJob>(queueName, refreshVendor, {
  connection,
  concurrency: 1,
});

worker.on('completed', (job) => {
  console.log(`[WORKER] Job ${job.id} completed.`);
});

worker.on('failed', (job, error) => {
  console.error(`[WORKER] Job ${job?.id ?? 'unknown'} failed:`, error);
});

worker.on('error', (error) => {
  console.error('[WORKER] Worker error:', error);
});

let isClosing = false;
async function shutdown(signal: string): Promise<void> {
  if (isClosing) return;
  isClosing = true;
  console.log(`[WORKER] ${signal} received. Shutting down...`);

  try {
    await worker.close();
    await connection.quit();
    await db.$client.end();
    process.exitCode = 0;
  } catch (error) {
    console.error('[WORKER] Error during shutdown:', error);
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

console.log(`[WORKER] Listening for jobs on "${queueName}".`);
