import { Router, Request, Response } from 'express';
import Shipment from '../models/Shipment';
import { packingListUpload } from '../middleware/upload';
import { getCarriersForShipment } from '../services/carrierSelector';
import { initiateEscalation, resumeEscalation } from '../services/escalationEngine';

const router = Router();

// GET all shipments (optionally filtered by status)
router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const shipments = await Shipment.find(filter).sort({ createdAt: -1 });
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

// GET single shipment
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      res.status(404).json({ message: 'משלוח לא נמצא' });
      return;
    }
    res.json(shipment);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

// POST create shipment and trigger escalation
router.post('/', (req: Request, res: Response) => {
  packingListUpload(req, res, async (err) => {
    if (err) {
      res.status(400).json({ message: err.message });
      return;
    }
    try {
      const body = req.body as Record<string, string>;

      // Validate shipment type before computing carriers
      const shipmentType = body.shipmentType as 'FCL' | 'LCL';
      if (!['FCL', 'LCL'].includes(shipmentType)) {
        res.status(400).json({ message: 'סוג משלוח לא תקין' });
        return;
      }

      const carriersQueue = getCarriersForShipment(
        body.releasePoint,
        shipmentType
      );
      if (carriersQueue.length === 0) {
        res.status(400).json({
          message: 'לא נמצאו ספקים עבור נקודת השחרור שנבחרה',
        });
        return;
      }

      const shipment = new Shipment({
        fileNumber: body.fileNumber,
        releasePoint: body.releasePoint,
        isDangerous: body.isDangerous === 'true',
        shipmentType,
        quantity: Number(body.quantity),
        weight: Number(body.weight),
        volume:
          body.volume && body.volume.trim() !== ''
            ? Number(body.volume)
            : undefined,
        destination: body.destination,
        specialNotes: body.specialNotes || undefined,
        packingListUrl: req.file
          ? `uploads/packing-lists/${req.file.filename}`
          : undefined,
        carriersQueue,
      });

      await shipment.save();

      // Send first email — if this fails, roll back the shipment
      try {
        await initiateEscalation(shipment._id.toString());
      } catch (emailError) {
        await Shipment.findByIdAndDelete(shipment._id);
        res.status(500).json({
          message: 'שגיאה בשליחת האימייל. המשלוח לא נשמר.',
          error: emailError,
        });
        return;
      }

      const saved = await Shipment.findById(shipment._id);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ message: 'שגיאת ולידציה', error });
    }
  });
});

// POST resume escalation for a paused shipment
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    await resumeEscalation(req.params.id);
    const shipment = await Shipment.findById(req.params.id);
    res.json(shipment);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'שגיאה בחידוש האשכול';
    res.status(400).json({ message: msg });
  }
});

// DELETE shipment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) {
      res.status(404).json({ message: 'משלוח לא נמצא' });
      return;
    }
    res.json({ message: 'המשלוח נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

export default router;
