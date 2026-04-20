import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';
import Shipment from '../models/Shipment';
import { getIo } from '../socket';

const FILE_NUMBER_RE = /6\d{6}/g;

/**
 * Starts a persistent IMAP connection to the Gmail inbox.
 * When a new message arrives, it scans the subject for a 7-digit
 * file number (starting with 6). If a matching Processing shipment
 * is found, it is paused immediately.
 */
export function startImapWatcher(): void {
  if (
    !process.env.GMAIL_USER ||
    !process.env.GMAIL_APP_PASSWORD
  ) {
    console.warn(
      '[IMAP Watcher] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping IMAP watcher.'
    );
    return;
  }

  function connect() {
    const imap = new Imap({
      user: process.env.GMAIL_USER as string,
      password: process.env.GMAIL_APP_PASSWORD as string,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: { interval: 10000, idleInterval: 300000, forceNoop: true },
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          console.error('[IMAP Watcher] Failed to open INBOX:', err.message);
          return;
        }
        console.log('[IMAP Watcher] Connected — watching inbox for replies.');

        // Listen for new messages arriving in real-time
        imap.on('mail', (numNewMsgs: number) => {
          if (numNewMsgs > 0) {
            fetchLatestMessages(imap, numNewMsgs);
          }
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error('[IMAP Watcher] Connection error:', err.message);
      // Reconnect after 60 seconds on error
      setTimeout(connect, 60_000);
    });

    imap.once('end', () => {
      console.warn('[IMAP Watcher] Connection ended — reconnecting in 60s...');
      setTimeout(connect, 60_000);
    });

    imap.connect();
  }

  connect();
}

function fetchLatestMessages(imap: Imap, count: number): void {
  imap.search(['UNSEEN'], (err, results) => {
    if (err || !results || results.length === 0) return;

    // Only process the most recent `count` unseen messages
    const toFetch = results.slice(-count);
    const fetch = imap.fetch(toFetch, { bodies: 'HEADER.FIELDS (SUBJECT FROM)', struct: true });

    fetch.on('message', (msg) => {
      let rawHeader = '';

      msg.on('body', (stream: Readable) => {
        stream.on('data', (chunk: Buffer) => {
          rawHeader += chunk.toString('utf8');
        });

        stream.once('end', async () => {
          try {
            const parsed = await simpleParser(rawHeader);
            const subject: string = (parsed.subject as string | undefined) ?? '';
            const fromEmail: string =
              (parsed.from?.value as Array<{ address?: string }> | undefined)?.[0]?.address ?? '';
            await handleIncomingEmail(subject, fromEmail);
          } catch {
            // ignore parse errors for individual messages
          }
        });
      });
    });

    fetch.once('error', (fetchErr: Error) => {
      console.error('[IMAP Watcher] Fetch error:', fetchErr.message);
    });
  });
}

async function handleIncomingEmail(subject: string, fromEmail: string): Promise<void> {
  const matches = subject.match(FILE_NUMBER_RE);
  if (!matches || matches.length === 0) return;

  for (const fileNumber of matches) {
    const shipment = await Shipment.findOne({
      fileNumber,
      status: 'Processing',
    });

    if (!shipment) continue;

    // Identify which carrier replied by matching the from address to the queue
    const matchedCarrier = shipment.carriersQueue.find((c) =>
      c.emails.some((e) => e.toLowerCase() === fromEmail.toLowerCase())
    );
    shipment.repliedBy = matchedCarrier?.name ?? (fromEmail || 'לא ידוע');
    shipment.status = 'Paused - Reply Received';
    await shipment.save();
    getIo()?.emit('shipment:updated', shipment.toObject());

    console.log(
      `[IMAP Watcher] Reply from "${shipment.repliedBy}" for shipment ${fileNumber} — escalation paused.`
    );
  }
}
