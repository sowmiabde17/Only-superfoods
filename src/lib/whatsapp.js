/**
 * WhatsApp URL helpers
 * Generates properly formatted wa.me deep links with pre-filled messages.
 */

const WHATSAPP_NUMBER = '917019760360';

/**
 * Build a WhatsApp deep link with a pre-filled message.
 * @param {string} message - The message to pre-fill
 * @returns {string} Full wa.me URL
 */
export function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a product-specific WhatsApp order link.
 * @param {object} product - Product from data/products.js
 * @param {string} packSize - Selected pack size string
 * @returns {string} Full wa.me URL
 */
export function productOrderLink(product, packSize) {
  const msg = product.whatsappMessage.replace('{{size}}', packSize);
  return whatsappLink(msg);
}

/**
 * Default generic WhatsApp link (no product context).
 */
export const defaultWhatsAppLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi! I'd like to order from Only Superfoods."
)}`;

