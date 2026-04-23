import cron from 'node-cron';
import Shipment from '../models/Shipment';
import { sendQuoteRequest } from './emailService';
import { getIo } from '../socket';

const ESCALATION_DELAY_MINUTES = 30;

/**
 * Starts the cron job that checks every minute for shipments
 * whose escalation timer has expired and sends the next carrier email.
 */
export function startEscalationEngine(): void {
  console.log('[Escalation Engine] Started — checking every minute.');

  cron.schedule('* * * * *', async () => {
    try {
      await processEscalations();
    } catch (error) {
      console.error('[Escalation Engine] Unexpected error:', error);
    }
  });
}

async function processEscalations(): Promise<void> {
  const now = new Date();
  const cutoffTime = new Date(
    now.getTime() - ESCALATION_DELAY_MINUTES * 60 * 1000
  );

  // Find Processing shipments whose last email was sent at least 30 minutes ago
  // 'Paused - Reply Received' shipments are intentionally excluded
  const shipments = await Shipment.find({
    status: 'Processing',
    lastEmailSentAt: { $lte: cutoffTime },
  });

  for (const shipment of shipments) {
    const nextIndex = shipment.currentCarrierIndex + 1;



    if (nextIndex < shipment.carriersQueue.length) {
      const nextCarrier = shipment.carriersQueue[nextIndex];

      try {
        await sendQuoteRequest(shipment, nextCarrier.emails);

        shipment.currentCarrierIndex = nextIndex;
        shipment.lastEmailSentAt = now;

        // Mark as Completed (queue finished) after the last carrier receives the email
        if (nextIndex === shipment.carriersQueue.length - 1) {
          shipment.status = 'Completed';
          shipment.isQueueFinished = true;
        }

        await shipment.save();
        getIo()?.emit('shipment:updated', shipment.toObject());
        console.log(
          `[Escalation Engine] Sent to ${nextCarrier.name} for shipment ${shipment.fileNumber}`
        );
      } catch (error) {
        console.error(
          `[Escalation Engine] Failed to send to ${nextCarrier.name} for ${shipment.fileNumber}:`,
          error
        );
      }
    } else {
      // Safety fallback — all carriers already contacted
      shipment.status = 'Completed';
      shipment.isQueueFinished = true;
      await shipment.save();
      getIo()?.emit('shipment:updated', shipment.toObject());
    }
  }
}

/**
 * Sends the very first quote request for a new shipment and sets its status.
 * Called immediately after a shipment is created.
 */
export async function initiateEscalation(shipmentId: string): Promise<string> {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment || shipment.carriersQueue.length === 0) return "";

  const firstCarrier = shipment.carriersQueue[0];

  await sendQuoteRequest(shipment, firstCarrier.emails);

  shipment.currentCarrierIndex = 0;
  shipment.lastEmailSentAt = new Date();
  // If there is only one carrier the escalation is already complete
  shipment.status =
    shipment.carriersQueue.length === 1 ? 'Completed' : 'Processing';
  if (shipment.carriersQueue.length === 1) shipment.isQueueFinished = true;

  await shipment.save();
  getIo()?.emit('shipment:updated', shipment.toObject());
  console.log(
    `[Escalation Engine] Initial email sent to ${firstCarrier.name} for shipment ${shipment.fileNumber}`
  );
  return firstCarrier.name;
}

/**
 * Resumes a paused shipment:
 * - Advances currentCarrierIndex to the next carrier
 * - Sends the email immediately
 * - Resets lastEmailSentAt so the 30-minute clock restarts from now
 * - Sets status back to Processing (or Completed if it was the last carrier)
 */
export async function resumeEscalation(shipmentId: string): Promise<string> {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found');

  if (shipment.status !== 'Paused - Reply Received') {
    throw new Error(
      `Cannot resume a shipment with status "${shipment.status}"`
    );
  }

  const nextIndex = shipment.currentCarrierIndex + 1;

  if (nextIndex >= shipment.carriersQueue.length) {
    // No more carriers — just mark completed
    shipment.status = 'Completed';
    shipment.isQueueFinished = true;
    await shipment.save();
    getIo()?.emit('shipment:updated', shipment.toObject());
    console.log(
      `[Escalation Engine] No more carriers for ${shipment.fileNumber} — marked Completed.`
    );
    return '';
  }

  const nextCarrier = shipment.carriersQueue[nextIndex];
  
  shipment.currentCarrierIndex = nextIndex;
  shipment.lastEmailSentAt = new Date();
  shipment.status =
  nextIndex === shipment.carriersQueue.length - 1 ? 'Completed' : 'Processing';
  if (nextIndex === shipment.carriersQueue.length - 1) shipment.isQueueFinished = true;
  
  await sendQuoteRequest(shipment, nextCarrier.emails);
  await shipment.save();
  getIo()?.emit('shipment:updated', shipment.toObject());
  console.log(
    `[Escalation Engine] Resumed — sent to ${nextCarrier.name} for shipment ${shipment.fileNumber}`
  );
  return nextCarrier.name;
}
