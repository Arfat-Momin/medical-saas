import Razorpay from 'razorpay';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
  logger.warn('Razorpay keys missing - subscription payments will not work');
}

export const razorpay = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export function requireRazorpay() {
  if (!razorpay) {
    throw new Error('Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }
  return razorpay;
}
