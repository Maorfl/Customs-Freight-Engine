import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import Carrier from '../models/Carrier';
import { priceListUpload } from '../middleware/upload';

const router = Router();

// GET all carriers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const carriers = await Carrier.find().sort({ name: 1 });
    res.json(carriers);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

// GET single carrier
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const carrier = await Carrier.findById(req.params.id);
    if (!carrier) {
      res.status(404).json({ message: 'ספק לא נמצא' });
      return;
    }
    res.json(carrier);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

// POST create carrier
router.post('/', async (req: Request, res: Response) => {
  try {
    const carrier = new Carrier(req.body);
    await carrier.save();
    res.status(201).json(carrier);
  } catch (error) {
    res.status(400).json({ message: 'שגיאת ולידציה', error });
  }
});

// PUT update carrier
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const carrier = await Carrier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!carrier) {
      res.status(404).json({ message: 'ספק לא נמצא' });
      return;
    }
    res.json(carrier);
  } catch (error) {
    res.status(400).json({ message: 'שגיאת ולידציה', error });
  }
});

// DELETE carrier
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const carrier = await Carrier.findByIdAndDelete(req.params.id);
    if (!carrier) {
      res.status(404).json({ message: 'ספק לא נמצא' });
      return;
    }
    // Remove associated price list file if it exists
    if (carrier.priceListUrl) {
      const uploadsBase = process.env.UPLOADS_PATH ?? path.join(__dirname, '../uploads');
      const relPath = carrier.priceListUrl.replace(/^uploads[\/\\]/, '');
      const filePath = path.join(uploadsBase, relPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.json({ message: 'הספק נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error });
  }
});

// POST upload / replace price list for a carrier
router.post('/:id/price-list', (req: Request, res: Response) => {
  priceListUpload(req, res, async (err) => {
    if (err) {
      res.status(400).json({ message: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'לא הועלה קובץ' });
      return;
    }
    try {
      const carrier = await Carrier.findById(req.params.id);
      if (!carrier) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ message: 'ספק לא נמצא' });
        return;
      }
      // Remove the old price list file before replacing
      if (carrier.priceListUrl) {
        const uploadsBase = process.env.UPLOADS_PATH ?? path.join(__dirname, '../uploads');
        const relPath = carrier.priceListUrl.replace(/^uploads[\/\\]/, '');
        const oldPath = path.join(uploadsBase, relPath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      carrier.priceListUrl = `uploads/price-lists/${req.file.filename}`;
      await carrier.save();
      res.json({ message: 'רשימת המחירים הועלתה בהצלחה', carrier });
    } catch (error) {
      res.status(500).json({ message: 'שגיאת שרת', error });
    }
  });
});

export default router;
