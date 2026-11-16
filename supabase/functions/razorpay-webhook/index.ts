/**
 * Only SuperFoods — Razorpay Webhook Edge Function
 * Automatically processes payment.captured, payment_link.paid, and order.paid events,
 * marks Supabase orders as 'paid' & 'confirmed', mutates the WhatsApp order card to remove "Pay Now",
 * and dispatches the official WhatsApp morning harvest confirmation receipt.
 */

// Global ambient declarations for Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WhatsAppClient } from './whatsapp.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ufewlbjqtxpumwlwkunn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '1364269023440389';
const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const wa = new WhatsAppClient(PHONE_NUMBER_ID, ACCESS_TOKEN);

console.log('[Razorpay Webhook] Edge function initialized.');

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Diagnostic & Manual Reconciliation endpoint
  if (req.method === 'GET') {
    if (url.searchParams.get('reconcile') === '1' && url.searchParams.get('secret') === 'osf_diag_2026') {
      const orderNum = url.searchParams.get('order_number') || 'OSF-578094';
      const { data: ord } = await supabase.from('orders').select('*').eq('order_number', orderNum).maybeSingle();

      if (!ord) {
        return new Response(JSON.stringify({ error: `Order ${orderNum} not found` }), { status: 404 });
      }

      let phone = (ord.customer_phone || '').replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;

      let statusResult = null;
      let receiptResult = null;

      try {
        statusResult = await wa.sendOrderStatus(
          phone,
          orderNum,
          'processing',
          'Payment Confirmed • Morning Harvest',
          `✅ *Payment Confirmed — Order #${orderNum}*\n\nYour order is confirmed and scheduled for morning harvest delivery.`
        );
      } catch (err: any) {
        statusResult = { error: err.message };
      }

      const items = ord.items || [];
      const itemsSummary = items.length > 0
        ? items.map((it: any) => `${it.name || 'Produce Item'}${it.packSize ? ` (${it.packSize})` : ''} × ${it.quantity || 1}`).join(', ')
        : 'Fresh Harvest Produce';
      const deliveryAddress = ord.delivery_address?.address || 'Kadugodi / Whitefield, Bangalore';
      const deliverySlot = ord.delivery_slot || 'Tomorrow Morning Drop (7:00 AM – 10:00 AM)';
      const totalAmount = Math.round(Number(ord.total_amount) || 0);

      try {
        receiptResult = await wa.sendOrderConfirmationReceipt(
          phone,
          orderNum,
          totalAmount,
          itemsSummary,
          deliveryAddress,
          deliverySlot
        );
      } catch (err: any) {
        receiptResult = { error: err.message };
      }

      return new Response(JSON.stringify({
        success: true,
        order_number: orderNum,
        phone,
        statusResult,
        receiptResult
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const event = body.event;

    console.log(`💳 Razorpay Webhook event received: ${event}`);

    // Process only payment success events
    if (event === 'payment.captured' || event === 'payment_link.paid' || event === 'order.paid') {
      const linkEntity = body.payload?.payment_link?.entity;
      const paymentEntity = body.payload?.payment?.entity;
      const orderEntity = body.payload?.order?.entity;

      // Extract notes and order number across link, payment, or order payload
      const notes = linkEntity?.notes || paymentEntity?.notes || orderEntity?.notes || {};
      let orderNumber = notes.order_number || paymentEntity?.notes?.order_number || orderEntity?.receipt || paymentEntity?.receipt;

      if (!orderNumber) {
        const desc = linkEntity?.description || paymentEntity?.description || '';
        const match = desc.match(/OSF-\d+/);
        if (match) orderNumber = match[0];
      }

      if (!orderNumber) {
        console.warn('⚠️ No order_number found in Razorpay payment notes, receipt, or description.', {
          linkNotes: linkEntity?.notes,
          payNotes: paymentEntity?.notes,
        });
        return new Response(JSON.stringify({ status: 'ignored_no_order_number' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Check current order in database for idempotency
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .maybeSingle();

      const rawAmount = paymentEntity?.amount || linkEntity?.amount_paid || linkEntity?.amount || orderEntity?.amount || 0;
      const amountPaid = rawAmount ? Math.round(rawAmount / 100) : (existingOrder ? Math.round(Number(existingOrder.total_amount)) : 0);
      const paymentId = paymentEntity?.id || linkEntity?.id || '';

      const targetPhone =
        existingOrder?.customer_phone ||
        linkEntity?.customer?.contact ||
        paymentEntity?.contact;

      let cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      if (existingOrder && existingOrder.payment_status === 'paid') {
        console.log(`ℹ️ Order #${orderNumber} is already recorded as 'paid'. Ensuring Meta order_status is synced.`);
        // Even if already marked paid, ensure Meta order card has removed the "Pay Now" button
        if (cleanPhone && ACCESS_TOKEN) {
          await wa.sendOrderStatus(
            cleanPhone,
            orderNumber,
            'processing',
            'Payment Confirmed • Morning Harvest'
          ).catch(() => {});
        }
        return new Response(JSON.stringify({ status: 'already_processed', order_number: orderNumber }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`✅ Payment verified for order #${orderNumber} — ₹${amountPaid} (Payment ID: ${paymentId})`);

      // 1. Update order in Supabase
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'confirmed',
          notes: paymentId ? `Paid via Razorpay: ${paymentId}` : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('order_number', orderNumber)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error('Error updating Supabase order:', updateError);
      }

      // Increment customer order activity
      if (cleanPhone) {
        await supabase
          .from('customers')
          .update({ last_active_at: new Date().toISOString() })
          .eq('phone', cleanPhone);
      }

      // 2. Dispatch Meta order_status Update (REMOVES the "Pay Now" button from customer phone)
      if (cleanPhone && ACCESS_TOKEN) {
        try {
          await wa.sendOrderStatus(
            cleanPhone,
            orderNumber,
            'processing',
            'Payment Confirmed • Morning Harvest',
            `✅ *Payment Confirmed — Order #${orderNumber}*\n\nYour order is confirmed and scheduled for morning harvest delivery.`
          );
          console.log(`[Razorpay Webhook] Meta order_status 'processing' sent for #${orderNumber} to remove Pay Now button`);
        } catch (statusErr: any) {
          console.warn('[Razorpay Webhook] Warning sending order_status to Meta:', statusErr?.message || statusErr);
        }

        // 3. Dispatch Rich Order Confirmation Receipt with Quick-Action Buttons (Zero payment buttons)
        const orderData = updatedOrder || existingOrder;
        const items = orderData?.items || [];
        const itemsSummary = items.length > 0
          ? items.map((it: any) => `${it.name || 'Produce Item'}${it.packSize ? ` (${it.packSize})` : ''} × ${it.quantity || 1}`).join(', ')
          : 'Fresh Harvest Produce';
        const deliveryAddress = orderData?.delivery_address?.address || 'Kadugodi / Whitefield, Bangalore';
        const deliverySlot = orderData?.delivery_slot || 'Tomorrow Morning Drop (7:00 AM – 10:00 AM)';

        try {
          await wa.sendOrderConfirmationReceipt(
            cleanPhone,
            orderNumber,
            amountPaid,
            itemsSummary,
            deliveryAddress,
            deliverySlot
          );
          console.log(`📲 Rich harvest confirmation receipt successfully sent to ${cleanPhone}`);
        } catch (receiptErr) {
          console.error('Failed to send rich confirmation receipt, attempting plain text fallback:', receiptErr);
          const fallbackText =
            `✅ *Payment Received — Order Confirmed!* 🍄\n\n` +
            `Order: *#${orderNumber}*\n` +
            `Amount: *₹${amountPaid}* (Paid via Online UPI)\n` +
            `Delivery Window: *${deliverySlot}*\n\n` +
            `Our growers will hand-pick your gourmet mushrooms and superfoods fresh on your scheduled morning. Thank you for supporting sustainable urban micro-farming! 🙏`;
          await wa.sendText(cleanPhone, fallbackText).catch(() => {});
        }
      } else {
        console.warn('⚠️ No customer phone or WhatsApp token available for dispatch.', {
          targetPhone,
          hasAccessToken: Boolean(ACCESS_TOKEN),
        });
      }

      return new Response(JSON.stringify({ status: 'success', order_number: orderNumber }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ status: 'ignored_event', event }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Razorpay Webhook processing error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
