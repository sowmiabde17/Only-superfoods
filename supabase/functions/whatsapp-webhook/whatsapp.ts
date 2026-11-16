/**
 * whatsapp.ts — Meta WhatsApp Cloud API (v20.0) Client for Deno
 */

const GRAPH_API_VERSION = 'v20.0';

export interface WhatsAppButton {
  id: string;
  title: string; // Max 20 chars
}

export interface ListRow {
  id: string;
  title: string; // Max 24 chars
  description?: string; // Max 72 chars
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export class WhatsAppClient {
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  private async post(endpoint: string, payload: unknown): Promise<any> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[WhatsApp API Error] ${endpoint}:`, JSON.stringify(data));
      throw new Error(JSON.stringify(data));
    }
    return data;
  }

  // 1. Send Simple Text Message
  async sendText(to: string, bodyText: string): Promise<any> {
    return this.post('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: bodyText },
    });
  }

  // 2. Send Interactive Quick-Reply Buttons (Up to 3 buttons)
  async sendButtons(
    to: string,
    bodyText: string,
    buttons: WhatsAppButton[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.slice(0, 20),
            },
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText.slice(0, 60) };
    }

    return this.post('messages', payload);
  }

  // 3. Send Interactive List Message (Up to 10 items in sections)
  async sendList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: ListSection[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText.slice(0, 20),
          sections: sections.map((sec) => ({
            title: sec.title.slice(0, 24),
            rows: sec.rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: r.description ? r.description.slice(0, 72) : undefined,
            })),
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
    }
    if (footerText) {
      payload.interactive.footer = { text: footerText.slice(0, 60) };
    }

    return this.post('messages', payload);
  }

  // 4. Send Interactive Location Request (1-Tap Share Location)
  async sendLocationRequest(to: string, bodyText: string): Promise<any> {
    return this.post('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText.slice(0, 1024) },
        action: { name: 'send_location' },
      },
    });
  }

  // 5. Send Native Catalog Message (Opens full WhatsApp shopping store in 1 tap)
  async sendCatalog(
    to: string,
    bodyText: string,
    thumbnailRetailerId?: string,
    footerText?: string
  ): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: bodyText.slice(0, 1024) },
        action: {
          name: 'catalog_message',
          parameters: thumbnailRetailerId
            ? { thumbnail_product_retailer_id: thumbnailRetailerId }
            : {},
        },
      },
    };

    if (footerText) {
      payload.interactive.footer = { text: footerText.slice(0, 60) };
    }

    return this.post('messages', payload);
  }

  // 6. Mark Incoming Message as Read (Shows blue double ticks)
  async markAsRead(messageId: string): Promise<any> {
    return this.post('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  // 7. Send Native Meta In-Chat Payment via Approved Template (order_details_pay)
  async sendOrderDetailsTemplate(
    to: string,
    customerName: string,
    orderNumber: string,
    items: Array<{ name: string; amount: number; quantity: number; retailer_id?: string }>,
    deliveryFee: number,
    configName: string = 'onlysuperfoods_pay',
    templateName: string = 'order_details_pay',
    langCode: string = 'en'
  ): Promise<any> {
    const cleanPhone = to.replace(/\D/g, '');
    const cleanCustomerName = (customerName || 'Friend').trim();
    const cleanOrderNumber = orderNumber.trim();

    let itemsTotalPaise = 0;
    const orderItems = items.map((it, idx) => {
      const unitPricePaise = Math.round((Number(it.amount) || 0) * 100);
      const qty = Number(it.quantity) || 1;
      itemsTotalPaise += unitPricePaise * qty;
      return {
        retailer_id: (it.retailer_id || `item_${idx + 1}`).slice(0, 50),
        name: (it.name || 'Produce Item').slice(0, 60),
        amount: {
          value: unitPricePaise,
          offset: 100,
        },
        quantity: qty,
        sale_amount: {
          value: unitPricePaise,
          offset: 100,
        },
      };
    });

    const shippingPaise = Math.round((Number(deliveryFee) || 0) * 100);
    const subtotalPaise = itemsTotalPaise;
    const totalPaise = subtotalPaise + shippingPaise;
    const totalRupees = Math.round(totalPaise / 100);

    const actionPayload: any = {
      order_details: {
        reference_id: cleanOrderNumber,
        type: 'physical-goods',
        payment_type: 'payment_gateway:razorpay',
        payment_settings: [
          {
            type: 'payment_gateway',
            payment_gateway: {
              type: 'razorpay',
              configuration_name: configName,
              razorpay: {
                receipt: cleanOrderNumber,
                notes: {
                  order_number: cleanOrderNumber,
                },
              },
            },
          },
        ],
        currency: 'INR',
        total_amount: {
          value: totalPaise,
          offset: 100,
        },
        order: {
          status: 'pending',
          items: orderItems,
          subtotal: {
            value: subtotalPaise,
            offset: 100,
          },
          shipping: {
            value: shippingPaise,
            offset: 100,
            description: shippingPaise > 0 ? 'Morning Delivery' : 'Free Morning Delivery',
          },
          tax: {
            value: 0,
            offset: 100,
          },
        },
      },
    };

    const buildPayload = (code: string) => ({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: cleanCustomerName },
              { type: 'text', text: cleanOrderNumber },
              { type: 'text', text: `₹${totalRupees}` },
            ],
          },
          {
            type: 'button',
            sub_type: 'order_details',
            index: 0,
            parameters: [
              {
                type: 'action',
                action: actionPayload,
              },
            ],
          },
        ],
      },
    });

    try {
      return await this.post('messages', buildPayload(langCode));
    } catch (err: any) {
      if (langCode === 'en') {
        console.warn(`[sendOrderDetailsTemplate] 'en' failed, attempting 'en_US' fallback...`, err?.message);
        try {
          return await this.post('messages', buildPayload('en_US'));
        } catch (_err2) {
          throw err;
        }
      }
      throw err;
    }
  }

  // 8. Send Native Meta In-Chat Payment (Interactive order_details fallback)
  async sendOrderDetailsPayment(
    to: string,
    orderNumber: string,
    bodyText: string,
    items: Array<{ name: string; amount: number; quantity: number; retailer_id?: string }>,
    subtotal: number,
    deliveryFee: number,
    total: number,
    configName: string = 'onlysuperfoods_pay'
  ): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'order_details',
        body: { text: bodyText },
        action: {
          name: 'review_and_pay',
          parameters: {
            reference_id: orderNumber,
            type: 'physical-goods',
            payment_type: 'upi',
            payment_configuration: configName,
            payment_settings: [
              {
                type: 'payment_gateway',
                payment_gateway: {
                  type: 'razorpay',
                  configuration_name: configName,
                  razorpay: {
                    receipt: orderNumber,
                    notes: { order_number: orderNumber },
                  },
                },
              },
            ],
            currency: 'INR',
            total_amount: {
              value: Math.round(total * 100),
              offset: 100,
            },
            order: {
              status: 'pending',
              items: items.map((it, idx) => {
                const itemPaise = Math.round((Number(it.amount) || 0) * 100);
                return {
                  retailer_id: (it.retailer_id || `item_${idx + 1}`).slice(0, 50),
                  name: (it.name || 'Produce Item').slice(0, 60),
                  amount: {
                    value: itemPaise,
                    offset: 100,
                  },
                  sale_amount: {
                    value: itemPaise,
                    offset: 100,
                  },
                  quantity: Number(it.quantity) || 1,
                };
              }),
              subtotal: {
                value: Math.round(subtotal * 100),
                offset: 100,
              },
              shipping: {
                value: Math.round(deliveryFee * 100),
                offset: 100,
                description: deliveryFee > 0 ? 'Morning Drop Delivery' : 'Free Local Delivery',
              },
              tax: {
                value: 0,
                offset: 100,
              },
              discount: {
                value: 0,
                offset: 100,
              },
            },
          },
        },
      },
    };

    return this.post('messages', payload);
  }

  // 9. Send Interactive Order Status (Mutates Meta order card and REMOVES the "Pay Now" button)
  async sendOrderStatus(
    to: string,
    orderNumber: string,
    status: 'pending' | 'processing' | 'partially-shipped' | 'shipped' | 'completed' | 'canceled' = 'processing',
    description: string = 'Payment Confirmed • 5:30 AM Morning Harvest',
    bodyText?: string,
    footerText?: string
  ): Promise<any> {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'order_status',
        body: {
          text: bodyText || `✅ *Payment Confirmed — Order #${orderNumber}* 🍄\n\nScheduled for fresh morning harvest in Kadugodi.`,
        },
        action: {
          name: 'review_order',
          parameters: {
            reference_id: orderNumber,
            order: {
              status,
              description: description.slice(0, 120),
            },
          },
        },
      },
    };

    if (footerText) {
      payload.interactive.footer = { text: footerText.slice(0, 60) };
    }

    return this.post('messages', payload);
  }

  // 10. Send Rich Order Confirmation Receipt with Quick-Reply Actions (Zero payment buttons)
  async sendOrderConfirmationReceipt(
    to: string,
    orderNumber: string,
    amount: number,
    itemsText: string,
    deliveryAddress: string,
    deliverySlot: string = 'Tomorrow Morning (7:00 AM – 10:00 AM)'
  ): Promise<any> {
    const bodyText =
      `🎉 *Payment Confirmed — Order #${orderNumber}!* 🍄\n\n` +
      `Thank you for choosing living nutrition! Your body and gut will love this fresh harvest. 🌱\n\n` +
      `📦 *Your Harvest Box:*\n${itemsText}\n\n` +
      `📍 *Delivering to:* ${deliveryAddress}\n` +
      `📅 *Scheduled Delivery:* ${deliverySlot}\n\n` +
      `✨ *Freshness Promise:*\n` +
      `Our growers will hand-pick your mushrooms and microgreens at 5:30 AM on your scheduled morning and deliver them cold to your doorstep. You'll receive a live update when our morning driver is on the way!\n\n` +
      `Thank you for supporting sustainable urban micro-farming! 🙏`;

    return this.sendButtons(
      to,
      bodyText,
      [
        { id: 'btn_recipes', title: '🥗 Check Recipes' },
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      '🍄 Only SuperFoods Kadugodi'
    );
  }

  // 11. Send 7-Day Interactive Date Picker List
  async send7DayDatePicker(
    to: string,
    startDate?: string | Date,
    bodyText?: string
  ): Promise<any> {
    const now = startDate ? new Date(startDate) : new Date();
    // Resolve current date in IST timezone (Asia/Kolkata) to eliminate off-by-one errors
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [y, m, d] = istFormatter.format(now).split('-').map(Number);

    const rows: ListRow[] = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 7; i++) {
      // Use midday UTC (12:00:00Z) so date shifts never flip calendar days in any timezone
      const cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const offsetDays = (!startDate ? 1 : 0) + i;
      cur.setUTCDate(cur.getUTCDate() + offsetDays);

      const yyyy = cur.getUTCFullYear();
      const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(cur.getUTCDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      const dayName = days[cur.getUTCDay()];
      const monthName = months[cur.getUTCMonth()];
      const dateNum = cur.getUTCDate();

      const title = i === 0 && !startDate
        ? `Tomorrow, ${monthName} ${dateNum}`
        : `${dayName}, ${monthName} ${dateNum}`;

      rows.push({
        id: `date_${dateKey}`,
        title: title.slice(0, 24),
        description: 'Fresh harvest • Delivered 7:00 AM – 10:00 AM',
      });
    }

    const sections: ListSection[] = [
      {
        title: 'Available Delivery Days'.slice(0, 24),
        rows,
      },
    ];

    const messageBody =
      bodyText ||
      '📅 *Select Morning Delivery Date*\n\nPlease choose which morning our growers should hand-pick and deliver your harvest (7:00 AM – 10:00 AM):';

    return this.sendList(
      to,
      messageBody,
      'Select Date',
      sections,
      'Morning Delivery Date'
    );
  }

  // 12. Send Express Delivery Offer for Out-of-Zone Locations
  async sendExpressDeliveryOffer(
    to: string,
    areaName: string = 'your location',
    prefilledText?: string
  ): Promise<any> {
    const cleanArea = areaName.replace(/[\n\r]+/g, ' ').trim();
    const bodyText =
      prefilledText ||
      `📍 *Delivery Outside Core Zone*\n\n` +
      `We noticed your address is in *${cleanArea}*, outside our standard Whitefield & Kadugodi morning delivery route.\n\n` +
      `We can arrange direct express delivery via Porter or Dunzo so your produce arrives fresh out of our grow rooms. 🛵\n\n` +
      `Would you like our team to check express courier rates for your location?`;

    return this.sendButtons(
      to,
      bodyText,
      [
        { id: 'btn_express_delivery', title: '🛵 Check Express' },
        { id: 'btn_change_address', title: '📍 Edit Address' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Delivery Outside Core Zone',
      'Kadugodi Farm Hub'
    );
  }
}

