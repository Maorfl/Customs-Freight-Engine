import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';
// pdf-parse CJS bundle wraps the callable under .default in some environments.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { PDFParse } from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Shipment from '../models/Shipment';
import { getIo } from '../socket';

const FILE_NUMBER_RE = /6\d{6}/g;

/**
 * Mapping from Hebrew terminal names (as they appear in the dispatch PDFs) to
 * internal port codes.  Populate with the exact Hebrew strings once known.
 */
const RELEASE_POINT_MAP: Record<string, string> = {
  // Fill in with the actual Hebrew strings extracted from dispatch PDFs, e.g.:
  // 'נמל חיפה':      'ILHFA',
  // 'מפרץ חיפה':     'ILHBT',
  // 'אוברסיז חיפה':  'ILOVR',
  // 'מדלוג חיפה':    'ILHDC',
  // 'נמל אשדוד':     'ILASH',
  // 'אשדוד דרום':    'ILAST',
  // 'אוברסיז אשדוד': 'ILOVO',
  // 'מסוף 207':      'ILMTS',
  // 'גולד בונד':     'ILCXQ',
  // 'בונדד אשדוד':   'ILBXQ',
};

interface ExtractedShipmentData {
  fileNumber?: string;
  destination?: string;
  releasePoint?: string;
  shipmentType: 'FCL' | 'LCL';
  containerSize?: 20 | 40;
  quantity?: number;
  weight?: number;
  volume?: number;
  isDangerous: boolean;
}

/** Extracts shipment fields from raw PDF text using regex / string matching.
 *
 *  pdf-parse / pdfjs reverses word order in RTL Hebrew PDFs, so labels appear
 *  REVERSED and values appear BEFORE the reversed label on the same line.
 *
 *  Example raw line:
 *    "1153208 שמונה קרית ,8 הירדן הובלה כתובת"
 *  Here "הובלה כתובת" is the reversed label for כתובת הובלה (destination)
 *  and everything before it on that line is the (also reversed) value.
 */
function extractShipmentData(text: string): ExtractedShipmentData {
  console.log('[IMAP Watcher] --- PDF Text Extracted ---');
  console.log('[IMAP Watcher] First 500 chars of raw text:\n', text.slice(0, 500));
  console.log('[IMAP Watcher] --- End of PDF Text Sample ---');

  /** Strip stray quotes/colons and whitespace from an extracted token. */
  const clean = (s: string) => s.replace(/["':]/g, '').trim();

  /**
   * The parsed text reverses word order.  Re-reverse the words in a string
   * to restore the original Hebrew reading order.
   * Example: "1153208 שמונה קרית ,8 הירדן" → "הירדן ,8 קרית שמונה 1153208"
   */
  const reverseWords = (s: string) => s.trim().split(/\s+/).reverse().join(' ');

  try {
    // fileNumber: 7 digits starting with 6 — position-independent
    const fileNumberMatch = text.match(/6\d{6}/);
    const fileNumber = fileNumberMatch?.[0];

    // destination: everything before reversed label "הובלה כתובת"
    const destMatch = text.match(/([^\n\r]+?)\s*הובלה כתובת/);
    const destination = destMatch
      ? reverseWords(clean(destMatch[1])) || undefined
      : undefined;

    // releasePoint: everything before reversed label "אווירי \ ימי מסוף"
    const releaseMatch = text.match(/([^\n\r]+?)\s*אווירי\s*[\\]\s*ימי מסוף/);
    const rawRelease = releaseMatch ? clean(releaseMatch[1]) : '';
    const releasePoint = RELEASE_POINT_MAP[rawRelease] || rawRelease || undefined;

    // containerType: everything before reversed label ":אריזה סוג" or "אריזה סוג"
    // Values: "20 - מכולה" / "40 - מכולה" / "מוגדר ובלתי שונים"
    const packagingMatch = text.match(/([^\n\r]+?)\s*:?אריזה סוג/);
    const packagingText = packagingMatch ? clean(packagingMatch[1]) : '';
    let shipmentType: 'FCL' | 'LCL' = 'LCL';
    let containerSize: 20 | 40 | undefined;
    // reversed "מכולה - 20" → "20 - מכולה"
    if (packagingText.includes('20 - מכולה') || packagingText.includes('מכולה - 20')) {
      shipmentType = 'FCL';
      containerSize = 20;
    } else if (packagingText.includes('40 - מכולה') || packagingText.includes('מכולה - 40')) {
      shipmentType = 'FCL';
      containerSize = 40;
    }

    // quantity: number before reversed label ":אריזות 'מס" / ":אריזות ׳מס"
    const quantityMatch = text.match(/(\d+)\s*:?אריזות\s*['׳]מס/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : undefined;

    // weight: decimal number before reversed label ":משקל" / "משקל"
    // Numbers may contain commas as thousands separators (e.g. 1,244.00)
    const weightMatch = text.match(/([\d.,]+)\s*:?משקל/);
    const weight = weightMatch
      ? parseFloat(clean(weightMatch[1]).replace(/,/g, ''))
      : undefined;

    // volume: decimal number before reversed label ":נפח" / "נפח" (LCL only)
    let volume: number | undefined;
    if (shipmentType === 'LCL') {
      const volumeMatch = text.match(/([\d.,]+)\s*:?נפח/);
      volume = volumeMatch
        ? parseFloat(clean(volumeMatch[1]).replace(/,/g, ''))
        : undefined;
    }

    // isDangerous: English word before reversed label "מסוכן חומר"
    // "Dangerous" → dangerous goods; "General" → not dangerous
    const dangerMatch = text.match(/([A-Za-z]+)\s*:?מסוכן חומר/) ||
                        text.match(/([A-Za-z]+)\s*:?חומר מסוכן/);
    const isDangerous = dangerMatch
      ? dangerMatch[1].toLowerCase().includes('dangerous')
      : false;

    const dataObj: ExtractedShipmentData = {
      fileNumber,
      destination,
      releasePoint,
      shipmentType,
      containerSize,
      quantity,
      weight,
      volume,
      isDangerous,
    };

    console.log('[IMAP Watcher] Extracted Data:', JSON.stringify(dataObj, null, 2));
    return dataObj;
  } catch (err) {
    console.error('[IMAP Watcher] extractShipmentData error:', err);
    return { shipmentType: 'LCL', isDangerous: false };
  }
}

/**
 * Gemini fallback: send the raw PDF buffer to Gemini Vision and ask it to
 * extract the shipment fields as structured JSON.
 */
async function extractShipmentDataViaGemini(
  pdfBuffer: Buffer
): Promise<ExtractedShipmentData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[IMAP Watcher] GEMINI_API_KEY not set — skipping Gemini fallback.');
    return null;
  }

  try {
    console.log('[IMAP Watcher] Trying Gemini fallback for PDF extraction...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a data extraction assistant. The following is a base64-encoded Israeli customs dispatch PDF written in Hebrew.
Extract the following fields and return ONLY a valid JSON object (no markdown, no explanation):
{
  "fileNumber": "7-digit number starting with 6, e.g. 6123456",
  "destination": "value next to כתובת הובלה",
  "releasePoint": "value next to מסוף ימי / אווירי",
  "shipmentType": "FCL if the packaging is מכולה, otherwise LCL",
  "containerSize": 20 or 40 (number) if FCL, otherwise null,
  "quantity": number from מס' אריזות,
  "weight": number from משקל,
  "volume": number from נפח (null if FCL),
  "isDangerous": true if חומר מסוכן contains Dangerous, otherwise false
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBuffer.toString('base64'),
        },
      },
    ]);

    const rawJson = result.response.text().trim();
    console.log('[IMAP Watcher] Gemini raw response:', rawJson);

    // Strip markdown code fences if present
    const jsonText = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const shipmentType: 'FCL' | 'LCL' =
      parsed.shipmentType === 'FCL' ? 'FCL' : 'LCL';
    const containerSizeRaw = parsed.containerSize as number | null;
    const containerSize: 20 | 40 | undefined =
      containerSizeRaw === 20 ? 20 : containerSizeRaw === 40 ? 40 : undefined;

    return {
      fileNumber: parsed.fileNumber as string | undefined,
      destination: parsed.destination as string | undefined,
      releasePoint: parsed.releasePoint as string | undefined,
      shipmentType,
      containerSize,
      quantity:
        parsed.quantity != null ? Number(parsed.quantity) : undefined,
      weight: parsed.weight != null ? Number(parsed.weight) : undefined,
      volume: parsed.volume != null ? Number(parsed.volume) : undefined,
      isDangerous: Boolean(parsed.isDangerous),
    };
  } catch (err) {
    console.error('[IMAP Watcher] Gemini extraction failed:', err);
    return null;
  }
}

/** Returns true if all required fields are present. */
function isComplete(data: ExtractedShipmentData): boolean {
  return !!(
    data.fileNumber &&
    data.destination &&
    data.releasePoint &&
    data.quantity != null &&
    data.weight != null
  );
}

/**
 * Processes a "Dispatch Note" email: extracts the PDF attachment, parses it
 * (with a Gemini fallback), and persists a new Shipment with status 'Preparation'.
 */
async function handleDispatchNote(parsed: ParsedMail): Promise<void> {
  const pdfAttachment = parsed.attachments?.find(
    (a) =>
      a.contentType === 'application/pdf' ||
      (a.filename?.toLowerCase().endsWith('.pdf') ?? false)
  );

  if (!pdfAttachment) {
    console.warn(
      '[IMAP Watcher] "Dispatch Note" email received but no PDF attachment found.'
    );
    return;
  }

  const pdfBuffer = pdfAttachment.content as Buffer;
  let data: ExtractedShipmentData | null = null;

  // ── Step 1: try pdf-parse ─────────────────────────────────────────────────
  try {
    // pdfjs-dist (bundled inside pdf-parse) requires a Uint8Array, not a Buffer
    const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
    const pdfData = new PDFParse(uint8);
    const parsedPdf = await pdfData.getText();
    data = extractShipmentData(parsedPdf.text);
    console.log('[IMAP Watcher] --- Extracted Data Object (pdf-parse) ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (parseErr) {
    console.error('[IMAP Watcher] pdf-parse failed:', parseErr);
  }

  // ── Step 2: Gemini fallback if pdf-parse missed any required fields ────────
  if (!data || !isComplete(data)) {
    console.warn(
      '[IMAP Watcher] pdf-parse result incomplete — falling back to Gemini.'
    );
    const geminiData = await extractShipmentDataViaGemini(pdfBuffer);
    if (geminiData) {
      data = geminiData;
      console.log('[IMAP Watcher] --- Extracted Data Object (Gemini) ---');
      console.log(JSON.stringify(data, null, 2));
    }
  }

  if (!data || !isComplete(data)) {
    console.warn(
      '[IMAP Watcher] Both extractors failed — could not extract all required fields.',
      data
    );
    return;
  }

  // ── Step 3: Save to MongoDB ───────────────────────────────────────────────
  const shipmentDoc = new Shipment({
    fileNumber: data.fileNumber,
    destination: data.destination,
    releasePoint: data.releasePoint,
    shipmentType: data.shipmentType,
    containerSize: data.containerSize,
    quantity: data.quantity,
    weight: data.weight,
    volume: data.volume,
    isDangerous: data.isDangerous,
    status: 'Preparation',
    carriersQueue: [],
    currentCarrierIndex: 0,
    isQueueFinished: false,
  });

  try {
    await shipmentDoc.save();
    getIo()?.emit('shipment:created', shipmentDoc.toObject());
    console.log(
      `[IMAP Watcher] ✓ Created Preparation shipment for file ${data.fileNumber}`
    );
  } catch (saveError: unknown) {
    console.error('[IMAP Watcher] MongoDB Save Error:', (saveError as Error).message);
    if (
      saveError &&
      typeof saveError === 'object' &&
      'errors' in saveError
    ) {
      console.error(
        '[IMAP Watcher] Mongoose Validation Errors:',
        JSON.stringify((saveError as { errors: unknown }).errors, null, 2)
      );
    }
  }
}

/**
 * Handles a regular incoming carrier-reply email.
 * Scans the subject for a 7-digit file number and pauses the matching shipment.
 */
async function handleIncomingEmail(
  subject: string,
  fromEmail: string
): Promise<void> {
  const matches = subject.match(FILE_NUMBER_RE);
  if (!matches || matches.length === 0) return;

  for (const fileNumber of matches) {
    const shipment = await Shipment.findOne({
      fileNumber,
      status: 'Processing',
    });

    if (!shipment) continue;

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

/**
 * Starts a persistent IMAP connection to the Gmail inbox.
 *
 * - Emails with the exact subject "Dispatch Note" trigger PDF extraction and
 *   create a new Preparation shipment.
 * - All other emails are scanned for a 7-digit file number to pause active
 *   escalations when a carrier replies.
 */
export function startImapWatcher(): void {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
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
        console.log('[IMAP Watcher] Connected — watching inbox for mail.');

        imap.on('mail', (numNewMsgs: number) => {
          if (numNewMsgs > 0) {
            fetchLatestMessages(imap, numNewMsgs);
          }
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error('[IMAP Watcher] Connection error:', err.message);
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

    const toFetch = results.slice(-count);

    // Fetch the full RFC 2822 message body so we can parse attachments
    const fetch = imap.fetch(toFetch, { bodies: '', struct: true });

    fetch.on('message', (msg) => {
      const chunks: Buffer[] = [];

      msg.on('body', (stream: Readable) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.once('end', async () => {
          try {
            const raw = Buffer.concat(chunks);
            const parsed = await simpleParser(raw);
            const subject: string =
              (parsed.subject as string | undefined) ?? '';
            const fromEmail: string =
              (
                parsed.from?.value as
                  | Array<{ address?: string }>
                  | undefined
              )?.[0]?.address ?? '';

            console.log('[IMAP Watcher] --- Incoming Email Detected ---');
            console.log('[IMAP Watcher] Subject:', subject);
            console.log('[IMAP Watcher] From:', fromEmail);
            console.log(
              '[IMAP Watcher] Has Attachments:',
              (parsed.attachments?.length ?? 0) > 0
            );

            if (subject.toLowerCase().includes('dispatch note')) {
              await handleDispatchNote(parsed);
            } else {
              await handleIncomingEmail(subject, fromEmail);
            }
          } catch (err) {
            console.error('[IMAP Watcher] Failed to parse message:', err);
          }
        });
      });
    });

    fetch.once('error', (fetchErr: Error) => {
      console.error('[IMAP Watcher] Fetch error:', fetchErr.message);
    });
  });
}
