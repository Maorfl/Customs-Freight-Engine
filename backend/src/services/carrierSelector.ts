export interface CarrierContact {
  name: string;
  emails: string[];
}

const HAIFA_PORTS = ['נמל חיפה', 'מפרץ חיפה', 'אוברסיז חיפה', 'מדלוג חיפה'];
const ASHDOD_PORTS = ['נמל אשדוד', 'אשדוד דרום', 'אוברסיז אשדוד', 'מסוף 207', 'גולד בונד', 'בונדד אשדוד'];

/**
 * Returns the ordered list of carrier contacts for a given shipment.
 * Emails are sent in order with a 30-minute delay between each.
 */
export function getCarriersForShipment(
  releasePoint: string,
  shipmentType: 'FCL' | 'LCL'
): CarrierContact[] {
  const carriers: CarrierContact[] = [];

  if (HAIFA_PORTS.includes(releasePoint)) {
    if (shipmentType === 'FCL') {
      carriers.push({
        name: 'קונטרם',
        emails: ['maorfl14@gmail.com'],
      });
    } else {
      carriers.push({ name: 'קונטרם', emails: ['maorfl14@gmail.com'] });
    }

    carriers.push({ name: 'ס.מ.א', emails: ['maorfl14@gmail.com'] });
    carriers.push({ name: 'טי.אל.אס', emails: ['maorfl14@gmail.com'] });
  } else if (ASHDOD_PORTS.includes(releasePoint)) {
    // Conterm is only included for מסוף 207 terminal
    if (releasePoint === 'מסוף 207') {
      carriers.push({ name: 'קונטרם', emails: ['maorfl14@gmail.com'] });
    }

    carriers.push({ name: 'ס.מ.א', emails: ['maorfl14@gmail.com'] });
    carriers.push({ name: 'טי.אל.אס', emails: ['maorfl14@gmail.com'] });
  }

  return carriers;
}
