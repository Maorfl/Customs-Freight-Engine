export interface CarrierContact {
  name: string;
  emails: string[];
}

const HAIFA_PORTS = ['ILHFA', 'ILHBT', 'ILOVR', 'ILHDC'];
const ASHDOD_PORTS = ['ILASH', 'ILAST', 'ILOVO', 'ILMTS', 'ILCXQ', 'ILBXQ'];

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
    carriers.push({ name: 'SME', emails: ['cus1@h-caspi.co.il'] });
    carriers.push({ name: 'TLS', emails: ['cus1@h-caspi.co.il'] });

    if (shipmentType === 'FCL') {
      carriers.push({
        name: 'Conterm',
        emails: ['cus1@h-caspi.co.il'],
      });
    } else {
      carriers.push({ name: 'Conterm', emails: ['cus1@h-caspi.co.il'] });
    }
  } else if (ASHDOD_PORTS.includes(releasePoint)) {
    carriers.push({ name: 'SME', emails: ['cus1@h-caspi.co.il'] });
    carriers.push({ name: 'TLS', emails: ['cus1@h-caspi.co.il'] });

    // Conterm is only included for ILCXQ terminal
    if (releasePoint === 'ILCXQ') {
      carriers.push({ name: 'Conterm', emails: ['cus1@h-caspi.co.il'] });
    }
  }

  return carriers;
}
