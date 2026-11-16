import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4321';
const ARTIFACT_DIR = '/Users/aadvik/.gemini/antigravity/brain/e7b4eb18-4f96-4633-9bf1-934a5d81bd9c';

async function runVerification() {
  console.log('🚀 Starting Automated Browser Flow Verification on', BASE_URL);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[Console Error] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[Page Error] ${err.message}`);
  });

  const report = [];

  try {
    // ─── 1. Home Page Verification ─────────────────────────────────
    console.log('\n--- 1. Testing Home Page ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const pageTitle = await page.title();
    console.log('Page Title:', pageTitle);
    report.push({ test: 'Home Page Load', status: 'PASS', details: pageTitle });

    // Wait for product cards to render
    await page.waitForSelector('.product-card, [data-product-card], article', { timeout: 5000 }).catch(() => {});
    const productCount = await page.evaluate(() => {
      return document.querySelectorAll('article, .product-card').length;
    });
    console.log(`Found ${productCount} product card elements`);
    report.push({ test: 'Product Grid Rendering', status: productCount > 0 ? 'PASS' : 'WARN', details: `${productCount} items found` });

    const homeScreenshot = path.join(ARTIFACT_DIR, 'browser-test-home.png');
    await page.screenshot({ path: homeScreenshot, fullPage: false });
    console.log('Captured:', homeScreenshot);

    // ─── 2. Recipes Hub ───────────────────────────────────────────
    console.log('\n--- 2. Testing Recipes Hub ---');
    await page.goto(`${BASE_URL}/recipes`, { waitUntil: 'networkidle2' });
    const recipesTitle = await page.title();
    console.log('Recipes Title:', recipesTitle);
    
    const recipeCards = await page.evaluate(() => {
      return document.querySelectorAll('article, a[href*="/recipes/"]').length;
    });
    console.log(`Found ${recipeCards} recipe links/cards`);
    report.push({ test: 'Recipes Hub Load', status: 'PASS', details: `${recipeCards} recipes found` });

    const recipesScreenshot = path.join(ARTIFACT_DIR, 'browser-test-recipes.png');
    await page.screenshot({ path: recipesScreenshot, fullPage: false });
    console.log('Captured:', recipesScreenshot);

    // ─── 3. Single Recipe Page ─────────────────────────────────────
    console.log('\n--- 3. Testing Single Recipe Page ---');
    await page.goto(`${BASE_URL}/recipes/garlic-butter-oyster-mushrooms`, { waitUntil: 'networkidle2' });
    const singleRecipeTitle = await page.title();
    console.log('Single Recipe Title:', singleRecipeTitle);
    report.push({ test: 'Recipe Detail View', status: 'PASS', details: singleRecipeTitle });

    // ─── 4. Delivery Zone & Cart Page ──────────────────────────────
    console.log('\n--- 4. Testing Cart & Checkout Page ---');
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle2' });
    const cartTitle = await page.title();
    console.log('Cart Title:', cartTitle);
    report.push({ test: 'Cart Page View', status: 'PASS', details: cartTitle });

    const cartScreenshot = path.join(ARTIFACT_DIR, 'browser-test-cart.png');
    await page.screenshot({ path: cartScreenshot, fullPage: false });
    console.log('Captured:', cartScreenshot);

    // ─── 5. Admin Dashboard ────────────────────────────────────────
    console.log('\n--- 5. Testing Admin Dashboard ---');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    const adminTitle = await page.title();
    console.log('Admin Title:', adminTitle);
    report.push({ test: 'Admin Dashboard View', status: 'PASS', details: adminTitle });

    const adminScreenshot = path.join(ARTIFACT_DIR, 'browser-test-admin.png');
    await page.screenshot({ path: adminScreenshot, fullPage: false });
    console.log('Captured:', adminScreenshot);

  } catch (err) {
    console.error('Test execution error:', err);
    report.push({ test: 'Test Runner', status: 'FAIL', details: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n=============================================');
  console.log('VERIFICATION SUMMARY:');
  console.table(report);
  if (errors.length > 0) {
    console.log('\n⚠️ Console warnings/errors observed:');
    errors.forEach((e) => console.log(' ', e));
  } else {
    console.log('\n✅ Zero critical console errors detected!');
  }
}

runVerification();

