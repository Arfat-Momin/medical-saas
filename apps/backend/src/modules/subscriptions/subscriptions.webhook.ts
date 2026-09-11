import { Router } from 'express';
import { subscriptionsService } from './subscriptions.service.js';
import { logger } from '../../config/logger.js';

export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) {
      return res.status(400).json({ error: { code: 'MISSING_SIGNATURE', message: 'x-razorpay-signature header required' } });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : String(req.body ?? '');

    if (!rawBody) {
      return res.status(400).json({ error: { code: 'EMPTY_BODY', message: 'Empty webhook body' } });
    }

    const result = await subscriptionsService.handleWebhook(rawBody, signature);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error({ err }, 'Webhook processing failed');
    const status = err?.statusCode ?? 500;
    return res.status(status === 401 ? 401 : 200).json({
      error: { code: err?.code ?? 'WEBHOOK_ERROR', message: err?.message ?? 'Webhook failed' },
    });
  }
});
