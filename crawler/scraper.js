/**
 * @deprecated Do not run in CI or production.
 * The Python pipeline_worker (pipeline_worker/main_orchestrator.py) is the
 * source of truth for temporal office hours and professor identity (email,
 * profile_url, fac_id). This Node scraper is retained for reference only.
 *
 * Dickinson College professor data scraper (legacy).
 */

import { chromium } from 'playwright';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const FACULTY_URL =
  process.env.FACULTY_DIRECTORY_URL ||
  'https://www.dickinson.edu/homepage/345/faculty_profiles';
const API_URL = process.env.API_URL;
const CRON_SECRET = process.env.INTERNAL_CRON_SECRET;
const BATCH_SIZE = 50;

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Normalizes a raw office hours string into structured JSON.
 * e.g. "Mon 10-12, Wed 2-4" -> {"Monday": ["10:00", "12:00"], "Wednesday": ["14:00", "16:00"]}
 * Handles common formats: "Mon 10:00-12:00", "M 10-12", "Monday 10am-12pm", "By appointment"
 */
function normalizeOfficeHours(raw) {
  const result = {};
  if (!raw || typeof raw !== 'string') return result;
  const s = raw.trim();
  if (!s || /by\s+appointment|tba|n\/a|none/i.test(s)) return result;

  const dayAliases = {
    sun: 'Sunday',
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    m: 'Monday',
    t: 'Tuesday',
    w: 'Wednesday',
    r: 'Thursday',
    f: 'Friday',
    s: 'Saturday',
  };

  // Match day name (abbrev or full) followed by time range(s)
  const dayRegex = new RegExp(
    `(${Object.keys(dayAliases).join('|')}|${DAYS.join('|')})\\s*([^;,]*(?:\\d{1,2}:?\\d{2}\\s*[-–to]+\\s*\\d{1,2}:?\\d{2}[^;,]*)*)`,
    'gi'
  );
  const timeRangeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;

  let match;
  while ((match = dayRegex.exec(s)) !== null) {
    const dayPart = match[1];
    const timePart = (match[2] || '').trim();
    const dayName =
      dayAliases[dayPart.toLowerCase().slice(0, 3)] ||
      dayAliases[dayPart.toLowerCase().slice(0, 1)] ||
      (DAYS.find((d) => d.toLowerCase().startsWith(dayPart.toLowerCase()))
        ? DAYS.find((d) => d.toLowerCase().startsWith(dayPart.toLowerCase()))
        : null);
    if (!dayName) continue;
    if (!result[dayName]) result[dayName] = [];

    const times = [];
    let tm;
    timeRangeRegex.lastIndex = 0;
    while ((tm = timeRangeRegex.exec(timePart)) !== null) {
      const to24 = (h, min, ampm) => {
        let hour = parseInt(h, 10);
        const minVal = parseInt(min || '0', 10);
        const isPm = (ampm || '').toLowerCase() === 'pm';
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        return `${String(hour).padStart(2, '0')}:${String(minVal).padStart(2, '0')}`;
      };
      times.push(to24(tm[1], tm[2], tm[3]));
      times.push(to24(tm[4], tm[5], tm[6]));
    }
    if (times.length) result[dayName].push(...times);
    else if (timePart) result[dayName].push(timePart);
  }

  return result;
}

/**
 * Scrapes the faculty directory page and returns an array of professor objects.
 * Adapts to common table/card layouts; extend selectors as needed for the live site.
 */
async function scrapeFacultyDirectory(page) {
  const professors = [];
  try {
    await page.goto(FACULTY_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err) {
    console.error('Navigation failed:', err.message);
    throw err;
  }

  // Wait for content (table or list of faculty)
  await page.waitForSelector('table, [class*="faculty"], [class*="directory"], .content, main', {
    timeout: 15000,
  }).catch(() => {});

  // Strategy 1: Table with rows (e.g. faculty list table)
  const rows = await page.$$('table tbody tr, table tr');
  if (rows.length > 1) {
    const headerCells = await page.$$('table thead th, table tr:first-child th, table tr:first-child td');
    const headerTexts = await Promise.all(
      headerCells.map((c) => c.textContent().then((t) => (t || '').trim().toLowerCase()))
    );
    const nameIdx = headerTexts.findIndex((h) => /name|title|profile/.test(h));
    const emailIdx = headerTexts.findIndex((h) => /email|contact/.test(h));
    const deptIdx = headerTexts.findIndex((h) => /department|dept|program/.test(h));
    const buildingIdx = headerTexts.findIndex((h) => /building|office|location/.test(h));
    const roomIdx = headerTexts.findIndex((h) => /room|office\s*room/.test(h));
    const hoursIdx = headerTexts.findIndex((h) => /hours|office\s*hours/.test(h));

    const dataRows = await page.$$('table tbody tr, table tr:not(:first-child)');
    for (const row of dataRows) {
      const cells = await row.$$('td, th');
      const texts = await Promise.all(cells.map((c) => c.textContent().then((t) => (t || '').trim())));
      const getLink = async (cell) => {
        const a = await cell.$('a[href^="mailto:"]');
        if (a) return (await a.getAttribute('href') || '').replace('mailto:', '').trim();
        return '';
      };
      const getByIndex = (i) => (i >= 0 && i < texts.length ? texts[i] : '');
      let email = '';
      if (emailIdx >= 0 && emailIdx < cells.length) {
        email = await getLink(cells[emailIdx]);
        if (!email) email = getByIndex(emailIdx);
      }
      if (!email || !email.includes('@')) {
        for (const cell of cells) {
          email = await getLink(cell);
          if (email && email.includes('@')) break;
        }
      }
      if (!email || !email.includes('@')) {
        const emailInText = texts.join(' ').match(/\S+@\S+\.\S+/);
        if (emailInText) email = emailInText[0].trim();
      }
      const name = getByIndex(nameIdx >= 0 ? nameIdx : 0);
      if (!name && !email) continue;
      professors.push({
        name: name || 'Unknown',
        email: email || null,
        department: getByIndex(deptIdx),
        building: getByIndex(buildingIdx),
        office_room: getByIndex(roomIdx),
        office_hours: normalizeOfficeHours(getByIndex(hoursIdx)),
      });
    }
  }

  // Strategy 2: If no table rows with data, try links to profile pages and scrape profile blocks
  if (professors.length === 0) {
    const profileLinkHandles = await page.$$('a[href*="faculty"], a[href*="profile"], a[href*="staff"]');
    const profileUrls = [];
    for (const node of profileLinkHandles) {
      const href = await node.getAttribute('href');
      if (href && (href.startsWith('http') || href.startsWith('/'))) {
        const url = href.startsWith('http') ? href : new URL(href, FACULTY_URL).href;
        if (!profileUrls.includes(url)) profileUrls.push(url);
      }
    }
    for (let i = 0; i < Math.min(profileUrls.length, 200); i++) {
      const url = profileUrls[i];
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const name =
          (await page.$eval('h1, .name, [class*="name"]', (el) => el?.textContent?.trim?.()).catch(() => '')) || '';
        const email =
          (await page.$eval('a[href^="mailto:"]', (el) => el?.href?.replace('mailto:', '')?.trim()).catch(() => '')) || '';
        const department =
          (await page.$eval('[class*="department"], [class*="dept"]', (el) => el?.textContent?.trim?.()).catch(() => '')) || '';
        const building =
          (await page.$eval('[class*="building"], [class*="office"]', (el) => el?.textContent?.trim?.()).catch(() => '')) || '';
        const officeRoom =
          (await page.$eval('[class*="room"]', (el) => el?.textContent?.trim?.()).catch(() => '')) || '';
        const officeHoursRaw =
          (await page.$eval('[class*="hours"]', (el) => el?.textContent?.trim?.()).catch(() => '')) || '';
        if (name || email) {
          professors.push({
            name: name || 'Unknown',
            email: email || null,
            department,
            building,
            office_room: officeRoom,
            office_hours: normalizeOfficeHours(officeHoursRaw),
          });
        }
      } catch (_) {
        // skip failed profile
      }
    }
  }

  // Strategy 3: Fallback — parse any visible text blocks that look like faculty (e.g. server-rendered list)
  if (professors.length === 0) {
    const main = await page.$('main, .main, #content, .content');
    const body = main || page;
    const text = await body.evaluate((el) => el?.innerText || '');
    const mailtos = await page.$$eval('a[href^="mailto:"]', (nodes) =>
      nodes.map((n) => ({ href: n.getAttribute('href'), text: n.textContent?.trim() }))
    );
    for (const m of mailtos) {
      const email = (m.href || '').replace('mailto:', '').trim();
      if (!email || !email.includes('@')) continue;
      professors.push({
        name: (m.text || '').trim() || email.split('@')[0],
        email,
        department: '',
        building: '',
        office_room: '',
        office_hours: {},
      });
    }
  }

  return professors;
}

/**
 * Splits an array into chunks of size BATCH_SIZE.
 */
function batch(arr, size = BATCH_SIZE) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * POSTs a single batch to the sync endpoint.
 */
async function postBatch(batchData, batchIndex) {
  const url = `${API_URL.replace(/\/$/, '')}/api/professors/sync`;
  let response;
  try {
    response = await axios.post(url, batchData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (reqErr) {
    const msg = reqErr.response
      ? `${reqErr.response.status} ${JSON.stringify(reqErr.response.data)}`
      : reqErr.code || reqErr.message || String(reqErr);
    throw new Error(`Request failed: ${msg}`);
  }
  if (response.status !== 200) {
    const detail = response.data ? JSON.stringify(response.data) : response.statusText;
    throw new Error(`Sync batch ${batchIndex + 1} failed: ${response.status} ${detail}`);
  }
  return response.data;
}

async function main() {
  console.error(
    '[scraper] DEPRECATED: Use pipeline_worker instead (poetry run python -m pipeline_worker.main_orchestrator).'
  );
  process.exit(1);

  console.log('[scraper] Starting Dickinson College professor scraper.');
  if (!API_URL || !CRON_SECRET) {
    console.error('[scraper] Missing API_URL or INTERNAL_CRON_SECRET. Set them in .env or environment.');
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    console.log('[scraper] Navigating to faculty directory:', FACULTY_URL);
    const extracted = await scrapeFacultyDirectory(page);
    const professors = extracted.filter(
      (p) => p.email != null && String(p.email).trim() !== '' && p.email.includes('@')
    );
    const skipped = extracted.length - professors.length;
    if (skipped > 0) {
      console.log('[scraper] Skipped', skipped, 'record(s) with missing or invalid email.');
    }
    console.log('[scraper] Posting', professors.length, 'professor(s) with valid email.');

    if (professors.length === 0) {
      console.warn('[scraper] No professors with valid email. Check FACULTY_DIRECTORY_URL and page structure.');
      await browser.close();
      process.exit(0);
    }

    const batches = batch(professors);
    console.log('[scraper] Posting', batches.length, 'batch(es) of up to', BATCH_SIZE, 'each.');

    for (let i = 0; i < batches.length; i++) {
      try {
        const result = await postBatch(batches[i], i);
        console.log('[scraper] Batch', i + 1, '/', batches.length, 'OK.', result?.data?.length ?? batches[i].length, 'records.');
      } catch (err) {
        const msg = err?.message ?? err?.response?.data ?? String(err);
        console.error('[scraper] Batch', i + 1, 'error:', msg);
        if (err?.response) {
          console.error('[scraper] Response status:', err.response.status, 'body:', err.response.data);
        }
        throw err;
      }
    }

    console.log('[scraper] Done. Total records synced:', professors.length);
  } catch (err) {
    const msg = err?.message ?? err?.response?.data ?? String(err);
    console.error('[scraper] Fatal error:', msg);
    if (err?.response) {
      console.error('[scraper] Response status:', err.response.status, 'body:', err.response.data);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
