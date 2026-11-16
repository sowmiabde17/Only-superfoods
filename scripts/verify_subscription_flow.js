import assert from 'node:assert';
import {
  DAYS_OF_WEEK,
  PLAN_DURATIONS,
  calculateSubscriptionTotals,
  generateSubscriptionId,
  getNextDropDate,
  copyBasketToOtherDays,
} from '../src/lib/subscriptionStore.js';

console.log('--- TEST 1: Plan Durations & Discounts ---');
assert.strictEqual(PLAN_DURATIONS.monthly.weeks, 4);
assert.strictEqual(PLAN_DURATIONS.monthly.discountPercent, 5);
assert.strictEqual(PLAN_DURATIONS.quarterly.weeks, 12);
assert.strictEqual(PLAN_DURATIONS.quarterly.discountPercent, 10);
assert.strictEqual(PLAN_DURATIONS.rolling.weeks, 1);
assert.strictEqual(PLAN_DURATIONS.rolling.discountPercent, 0);
console.log('✓ Plan durations verified.');

console.log('--- TEST 2: Multi-Day Independent Basket Financials ---');
// Scenario: Customer selects Monday & Thursday (2x/week)
// Monday basket: 1x Desi Eggs (₹90) + 1x Sunflower Microgreens (₹20) = ₹110
// Thursday basket: 2x Grey Oyster Mushrooms (₹100 each = ₹200) = ₹200
// Total weekly produce subtotal = ₹110 + ₹200 = ₹310
const dayBaskets = {
  Monday: [
    { productId: 'desi-eggs', name: 'Desi Eggs', packSize: '6 pcs', price: 90, quantity: 1 },
    { productId: 'sunflower-microgreens', name: 'Sunflower Microgreens', packSize: '50 g', price: 20, quantity: 1 },
  ],
  Thursday: [
    { productId: 'grey-oyster', name: 'Grey Oyster Mushrooms', packSize: '250 g', price: 100, quantity: 2 },
  ],
};
const selectedDays = ['Monday', 'Thursday'];

// Monthly calculation: 4 weeks, 5% discount
const monthlyCalc = calculateSubscriptionTotals(dayBaskets, selectedDays, 'monthly');
assert.strictEqual(monthlyCalc.weeklyBaseTotal, 310);
assert.strictEqual(monthlyCalc.totalDrops, 2 * 4); // 8 drops
assert.strictEqual(monthlyCalc.totalBasePrice, 310 * 4); // ₹1240
// 5% discount on 1240 = ₹62
assert.strictEqual(monthlyCalc.discountAmount, 62);
assert.strictEqual(monthlyCalc.deliveryFee, 0); // Waived for subscribers
assert.strictEqual(monthlyCalc.deliverySavings, 8 * 40); // ₹320 saved
assert.strictEqual(monthlyCalc.finalPayable, 1240 - 62); // ₹1178
console.log('✓ Monthly 2x/week calculation verified (₹1178 for 4 weeks).');

// Quarterly calculation: 12 weeks, 10% discount
const quarterlyCalc = calculateSubscriptionTotals(dayBaskets, selectedDays, 'quarterly');
assert.strictEqual(quarterlyCalc.weeklyBaseTotal, 310);
assert.strictEqual(quarterlyCalc.totalDrops, 2 * 12); // 24 drops
assert.strictEqual(quarterlyCalc.totalBasePrice, 310 * 12); // ₹3720
// 10% discount on 3720 = ₹372
assert.strictEqual(quarterlyCalc.discountAmount, 372);
assert.strictEqual(quarterlyCalc.deliveryFee, 0);
assert.strictEqual(quarterlyCalc.deliverySavings, 24 * 40); // ₹960 saved
assert.strictEqual(quarterlyCalc.finalPayable, 3720 - 372); // ₹3348
console.log('✓ Quarterly 2x/week calculation verified (₹3348 for 12 weeks).');

// Rolling calculation: 1 week, 0% discount
const rollingCalc = calculateSubscriptionTotals(dayBaskets, selectedDays, 'rolling');
assert.strictEqual(rollingCalc.weeklyBaseTotal, 310);
assert.strictEqual(rollingCalc.totalDrops, 2);
assert.strictEqual(rollingCalc.totalBasePrice, 310);
assert.strictEqual(rollingCalc.discountAmount, 0);
assert.strictEqual(rollingCalc.finalPayable, 310);
console.log('✓ Flexible Rolling calculation verified (₹310/week).');

console.log('--- TEST 3: Frequency 3x and 4x Validation ---');
const fourDayBaskets = {
  Monday: [{ price: 100, quantity: 1 }],
  Wednesday: [{ price: 100, quantity: 1 }],
  Friday: [{ price: 100, quantity: 1 }],
  Saturday: [{ price: 100, quantity: 1 }],
};
const fourDays = ['Monday', 'Wednesday', 'Friday', 'Saturday'];
const fourDayMonthly = calculateSubscriptionTotals(fourDayBaskets, fourDays, 'monthly');
assert.strictEqual(fourDayMonthly.weeklyBaseTotal, 400);
assert.strictEqual(fourDayMonthly.totalDrops, 16);
assert.strictEqual(fourDayMonthly.totalBasePrice, 1600);
assert.strictEqual(fourDayMonthly.discountAmount, 80); // 5% of 1600
assert.strictEqual(fourDayMonthly.finalPayable, 1520);
console.log('✓ 4x/week frequency verified.');

console.log('--- TEST 4: Copy Basket To Other Days Helper ---');
const targetDays = ['Monday', 'Thursday', 'Saturday'];
const updatedBaskets = copyBasketToOtherDays('Monday', targetDays, dayBaskets);
assert.strictEqual(updatedBaskets.Thursday.length, 2);
assert.strictEqual(updatedBaskets.Thursday[0].name, 'Desi Eggs');
assert.strictEqual(updatedBaskets.Saturday.length, 2);
assert.strictEqual(updatedBaskets.Saturday[1].name, 'Sunflower Microgreens');
console.log('✓ copyBasketToOtherDays verified.');

console.log('--- TEST 5: Subscription ID Generator ---');
const subId = generateSubscriptionId();
assert(subId.startsWith('SUB-'));
assert.strictEqual(subId.length, 10);
console.log(`✓ Subscription ID generator verified: ${subId}`);

console.log('--- TEST 6: Next Drop Resolver ---');
const nextDrop = getNextDropDate(['Monday', 'Thursday']);
assert(typeof nextDrop === 'string' && nextDrop.length > 0);
console.log(`✓ Next drop resolved: "${nextDrop}"`);

console.log('\n🎉 ALL 6 SUBSCRIPTION ENGINE TESTS PASSED WITH 100% SUCCESS!');

