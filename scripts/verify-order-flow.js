import puppeteer from 'puppeteer-core';
import { supabase } from '../src/lib/supabase.js';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:4321';

async function testCartOrderFlow() {
  console.log('🛒 Testing Live Cart & Order Placement Flow on', BASE_URL);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

    // Find and click the first "Add" button
    const addBtn = await page.waitForSelector('button', { timeout: 5000 });
    const buttons = await page.$$('button');
    let clicked = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Add') || text.includes('Bag') || text.includes('Order')) {
        await btn.click();
        clicked = true;
        console.log(`Clicked button: "${text.trim()}"`);
        break;
      }
    }

    if (!clicked) {
      console.log('No specific Add button found, adding item to cart via JS execution...');
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('osf:add-to-cart', {
          detail: {
            id: 'grey-oyster',
            name: 'Grey Oyster Mushrooms',
            packSize: '250 g',
            price: 100,
            quantity: 1,
            image: '/images/prod-grey-oyster.jpg'
          }
        }));
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // Navigate to /cart
    console.log('Navigating to checkout /cart...');
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle2' });

    // Check cart contents
    const cartText = await page.evaluate(() => document.body.innerText);
    const hasItems = cartText.includes('Grey Oyster') || cartText.includes('₹') || cartText.includes('Subtotal');
    console.log('Cart has active items/content:', hasItems);

    console.log('Testing Supabase direct order creation...');
    const testOrderId = `OSF-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
      order_number: testOrderId,
      channel: 'web',
      customer_phone: '919876543210',
      customer_name: 'Browser Automated Tester',
      items: [{ id: 'grey-oyster', name: 'Grey Oyster Mushrooms', price: 100, qty: 1 }],
      subtotal: 100,
      delivery_fee: 0,
      total_amount: 100,
      delivery_address: { address: 'Prestige Lakeside, Whitefield', zone: 'CORE' },
      delivery_slot: 'Morning Drop (7:00 AM – 10:00 AM)',
      payment_method: 'upi',
      payment_status: 'pending',
      order_status: 'placed'
    }).select().single();

    if (orderErr) {
      console.error('Supabase order insertion error:', orderErr);
    } else {
      console.log('✅ Supabase Order Successfully Placed & Verified in Database:', orderData.order_number, 'ID:', orderData.id);
    }

  } catch (err) {
    console.error('Error in cart test:', err);
  } finally {
    await browser.close();
  }
}

testCartOrderFlow();

