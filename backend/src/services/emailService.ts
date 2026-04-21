import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { IShipment } from '../models/Shipment';

const PORT_NAMES: Record<string, string> = {
  ILHFA: 'נמל חיפה',
  ILHBT: 'מסוף בית שאן',
  ILOVR: 'נמל עכו',
  ILHDC: 'מסוף דרום חיפה',
  ILASH: 'נמל אשדוד',
  ILAST: 'מסוף אשדוד דרום',
  ILOVO: 'נמל אשדוד',
  ILMTS: 'מסוף אשדוד',
  ILCXQ: 'מסוף ILCXQ אשדוד',
  ILBXQ: 'מסוף ILBXQ אשדוד',
};

function buildEmailBody(shipment: IShipment): string {
  const portName = PORT_NAMES[shipment.releasePoint] || shipment.releasePoint;

  let shipmentTypeText: string;
  if (shipment.shipmentType === 'FCL') {
    const sizeLabel = shipment.containerSize ? ` ${shipment.containerSize}'` : '';
    shipmentTypeText =
      shipment.quantity === 1
        ? `מכולה מלאה${sizeLabel}`
        : `${shipment.quantity} מכולות מלאות${sizeLabel}`;
  } else {
    shipmentTypeText = 'משלוח חלקי';
  }
  

  let body = `היי,\n\n`;
  body += `נשמח לקבל הצעת מחיר עבור הובלה של ${shipmentTypeText} מ${portName} ל${shipment.destination}.\n`;
  body += `כמות - ${shipment.quantity}, משקל - ${shipment.weight} ק"ג`;

  if (shipment.shipmentType === 'LCL' && shipment.volume != null) {
    body += `, נפח - ${shipment.volume} מ"ק`;
  }
  body += `.\n`;

  if (shipment.isDangerous) {
    body += `\nסחורה מסוכנת.\n`;
  }

  if (shipment.specialNotes) {
    body += `\n${shipment.specialNotes}\n`;
  }

  if (shipment.packingListUrl) {
    body += `\n\nמצ"ב רשימת תכולה עם מידות`;
  }

  return body;
}

function buildEmailHtml(plainText: string): string {
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `
    <div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; direction: rtl;
                          text-align: right; line-height: 1.7; font-size: 14px; color: #1a1a1a;">
      ${escaped}
    </div>
  `;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendQuoteRequest(
  shipment: IShipment,
  toEmails: string[]
): Promise<void> {
  const transporter = createTransporter();
  const subject = `הצעת מחיר - ${shipment.fileNumber}`;
  const plainBody = buildEmailBody(shipment);
  const htmlBody = buildEmailHtml(plainBody);

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Customs Freight - H.Caspi" <${process.env.GMAIL_USER}>`,
    to: toEmails.join(', '),
    cc: 'cus1@h-caspi.co.il',
    subject,
    text: plainBody,
    html: htmlBody,
  };

  // Attach packing list if one was uploaded
  if (shipment.packingListUrl) {
    const filePath = path.join(
      __dirname,
      '../../',
      shipment.packingListUrl
    );
    if (fs.existsSync(filePath)) {
      mailOptions.attachments = [
        {
          filename: path.basename(filePath),
          path: filePath,
        },
      ];
    }
  }

  await transporter.sendMail(mailOptions);
}
