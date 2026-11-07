// S1-10: the whole app on an emulated phone (specs/10). Data comes from the saved fixtures (stack.ts),
// so the places and dates below are those of 2026-11-03.
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AVENUE_M = { latitude: 40.61834, longitude: -73.95921 };
const MORRISTOWN_STATION = { latitude: 40.79739, longitude: -74.47448 };
const LOT_52 = { latitude: 40.72158, longitude: -74.04504 };
const MONTGOMERY_SITE = { latitude: 40.71703, longitude: -74.04278 };
const WNY_66TH = { latitude: 40.79023, longitude: -74.00471 };
const HOBOKEN_GARAGE_B = { latitude: 40.73804, longitude: -74.02905 };

async function recommendationsRequest(page: Page, action: () => Promise<void>): Promise<URL> {
  const [request] = await Promise.all([page.waitForRequest((request) => request.url().includes('/api/parking/recommendations')), action()]);
  return new URL(request.url());
}

declare const axe: { run: (context: Document, options: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> };
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

/** WEB-2 in a real browser, where axe can check colour contrast too. */
async function axeViolations(page: Page): Promise<{ id: string; targets: string[] }[]> {
  await page.addScriptTag({ path: axePath });
  const { violations } = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
  return violations.map((violation) => ({ id: violation.id, targets: violation.nodes.flatMap((node) => node.target) }));
}

test.describe('with location sharing on', () => {
  test.use({ geolocation: AVENUE_M, permissions: ['geolocation'] });

  test('S1-10 finds parking near the device: metered hours, sources, and the rounded point only', async ({ page }) => {
    await page.goto('/');

    const url = await recommendationsRequest(page, () => page.getByRole('button', { name: 'Use my location' }).click());

    expect(Object.fromEntries(url.searchParams)).toEqual({ lat: '40.618', lng: '-73.959', radius: '2000' });
    await expect(page.getByRole('heading', { name: '1 place within 2 km' })).toBeVisible();
    const card = page.getByRole('article', { name: 'Avenue M Municipal Parking Field' });
    await expect(card.getByText('Parking field · City-run · 90 m away')).toBeVisible();
    await expect(card.getByText('Pay at the meter Mon–Sat, 7:00 AM to 10:00 PM')).toBeVisible();
    await expect(card.getByText('Time limit: 4 hours or 15 hours, depending on the meter')).toBeVisible();
    await expect(
      card.getByRole('link', { name: 'Data: Facilities Database, as of Jul 16, 2026 and Parking Meters Locations and Status, as of Nov 2, 2026' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '1. Avenue M Municipal Parking Field, 90 m away' })).toBeVisible();
  });

  test('WEB-2 search results have no axe violations, including colour contrast', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByRole('heading', { name: '1 place within 2 km' })).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('at an NJ Transit station', () => {
  test.use({ geolocation: MORRISTOWN_STATION, permissions: ['geolocation'] });

  test('S2-9 shows the station\'s lots by number, and filters them by operator type', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();

    const transitLot = page.getByRole('article', { name: 'Morristown, lot 1' });
    const townLot = page.getByRole('article', { name: 'Morristown, lot 2' });
    await expect(transitLot.getByText(/^Lot · Transit agency · \d+ m away$/)).toBeVisible();
    await expect(townLot.getByText(/^Lot · City-run · \d+ m away$/)).toBeVisible();
    await expect(townLot.getByRole('link', { name: /^Data: Parking Lot Database View, as of Oct 8, 2026$/ })).toBeVisible();
    // Lot 3 is recorded as part private, so it's never shown (ING-11).
    await expect(page.getByRole('article', { name: 'Morristown, lot 3' })).toHaveCount(0);

    const url = await recommendationsRequest(page, () => page.getByRole('checkbox', { name: 'Transit agency' }).uncheck());

    expect(url.searchParams.getAll('operatorType')).toEqual(['municipal', 'county', 'state', 'public_authority', 'unknown']);
    await expect(townLot).toBeVisible();
    await expect(transitLot).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('in Jersey City', () => {
  test.describe('at Lot 52', () => {
    test.use({ geolocation: LOT_52, permissions: ['geolocation'] });

    test('S4-7 shows a city lot, and says its hours, rates, and spaces aren\'t shown', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Use my location' }).click();

      const lot = page.getByRole('article', { name: 'Lot 52' });
      await expect(lot.getByText(/^Lot · City-run · \d+ m away$/)).toBeVisible();
      await expect(lot.getByText('Not shown here: hours, rates, and number of spaces. Check with the operator before you park.')).toBeVisible();
      await expect(lot.getByRole('link', { name: 'Hours and rates on the operator’s page, for Lot 52' })).toHaveAttribute('href', /jerseycitynj\.gov/);
      await expect(lot.getByRole('link', { name: /^Data: Municipal Parking Lots, as of Nov 25, 2020/ })).toBeVisible();
      // WEB-10: directions to the lot, with only its location.
      await expect(lot.getByRole('link', { name: 'Google Maps directions to Lot 52' })).toHaveAttribute(
        'href', 'https://www.google.com/maps/dir/?api=1&destination=40.72158%2C-74.04504&travelmode=driving');
      await expect(lot.getByRole('link', { name: 'Apple Maps directions to Lot 52' })).toBeVisible();
      await expect(lot.getByRole('link', { name: 'Waze directions to Lot 52' })).toBeVisible();
    });
  });

  test.describe('at an unconfirmed site', () => {
    test.use({ geolocation: MONTGOMERY_SITE, permissions: ['geolocation'] });

    test('S4-7 marks a site from tax records as unconfirmed, with no operator link', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Use my location' }).click();

      const site = page.getByRole('article', { name: '179 Montgomery St.' });
      await expect(site.getByText('Unconfirmed: tax records list this as public land used for parking.', { exact: false })).toBeVisible();
      await expect(site.getByText(/^Lot · Owner not recorded · \d+ m away$/)).toBeVisible();
      await expect(site.getByRole('link', { name: /operator’s page/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^1\. 179 Montgomery St\., \d+ m away, unconfirmed$/ })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);

      await page.getByRole('checkbox', { name: 'Show unconfirmed sites (from tax records)' }).uncheck();
      await expect(site).toHaveCount(0);
    });
  });
});

test.describe('in West New York', () => {
  test.use({ geolocation: WNY_66TH, permissions: ['geolocation'] });

  test('S4-12 shows a lot\'s spaces, metered hours, and rates, with nothing listed as missing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();

    const lot = page.getByRole('article', { name: '66th Street Parking Lot' });
    await expect(lot.getByText('73 spaces')).toBeVisible();
    await expect(lot.getByText('Pay at the meter Mon–Sat, 9:00 AM to 9:00 PM')).toBeVisible();
    await expect(lot.getByText('$0.75 per hour, Mon–Sat, 9:00 AM to 9:00 PM')).toBeVisible();
    await expect(lot.getByText('Overnight pass: $10.00, every day, 9:01 PM to 9:00 AM')).toBeVisible();
    await expect(lot.getByText(/^Not shown here/)).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('in Hoboken', () => {
  test.use({ geolocation: HOBOKEN_GARAGE_B, permissions: ['geolocation'] });

  test('S4-15 shows the garages taking hourly parkers, with their spaces, and not Garage G', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();

    const garage = page.getByRole('article', { name: 'Garage B' });
    await expect(garage.getByText(/^Garage · City-run · \d+ m away$/)).toBeVisible();
    await expect(garage.getByText('829 spaces')).toBeVisible();
    await expect(garage.getByText(/^Not shown here: hours and rates\./)).toBeVisible();
    await expect(garage.getByRole('link', { name: 'Hours and rates on the operator’s page, for Garage B' })).toHaveAttribute('href', /hobokennj\.gov/);
    await expect(garage.getByRole('link', { name: /^Data: Municipal Garages and Lots, as of Nov 6, 2026/ })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Midtown Garage' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Garage G' })).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test('S4-10 searches near a typed address, chosen from suggestions', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'Search near a town or address' });

  await box.fill('174 Newark Ave, Jersey City');
  await page.getByRole('option', { name: /174 Newark Avenue, Jersey City/ }).click();

  await expect(page.getByText('Searching near 174 Newark Avenue, Jersey City, NJ, 07302')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lot 52' })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

test('S4-10 suggests a town from the built-in list', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'Search near a town or address' });

  await box.fill('Hoboken, NJ');
  await expect(page.getByRole('option', { name: /Hoboken City/ })).toBeVisible();
  await box.press('ArrowDown');
  await box.press('Enter');

  await expect(page.getByText('Searching near Hoboken City')).toBeVisible();
});

test('S1-10 points to the map when location sharing is off', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.getByText('Location sharing is off for this site. Tap the map to search there instead', { exact: false })).toBeVisible();
});

test('S1-10 searches where the map is tapped, and a marker leads to its card', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search within').selectOption('5000');
  const map = page.locator('.results-map__canvas');
  await expect(map.locator('canvas')).toBeVisible();
  // On a phone the map starts below the search controls, so scroll to it as a person would.
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;

  const url = await recommendationsRequest(page, () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2));

  // The map opens on 40.73, -73.97; the tap is rounded to at most 3 decimal places (PRIV-3).
  for (const name of ['lat', 'lng']) expect(url.searchParams.get(name)).toMatch(/^-?\d+(\.\d{1,3})?$/);
  expect(Math.abs(Number(url.searchParams.get('lat')) - 40.73)).toBeLessThan(0.003);
  expect(Math.abs(Number(url.searchParams.get('lng')) + 73.97)).toBeLessThan(0.003);
  expect(url.searchParams.get('radius')).toBe('5000');
  await expect(page.getByRole('heading', { name: /within 5 km$/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map of public parking. Tap a point to search there.' })).toHaveCount(1);

  const cards = page.getByRole('article');
  const markers = page.locator('.map-marker--facility');
  await expect(markers).toHaveCount(await cards.count());
  await markers.first().click();
  await expect(cards.first()).toBeFocused();
});

test('S1-10 lists the data sources, and every page carries the disclaimer', async ({ page }) => {
  const disclaimer = page.getByText('[Placeholder, PRD-2]', { exact: false });
  await page.goto('/');
  await expect(disclaimer).toBeVisible();

  await page.getByRole('link', { name: 'Data sources' }).click();

  await expect(page).toHaveURL(/\/sources$/);
  await expect(page.getByRole('article', { name: 'Facilities Database' }).getByText('Data as of July 16, 2026')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Parking Meters Locations and Status' }).getByText('Data as of November 2, 2026')).toBeVisible();
  await expect(disclaimer).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});
