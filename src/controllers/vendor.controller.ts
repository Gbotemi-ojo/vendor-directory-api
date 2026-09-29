import { Request, Response } from 'express';
import { vendorService } from '../services/vendor.service';

export class VendorController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const rawSearch = req.query.search;
      const search = typeof rawSearch === 'string' ? rawSearch : undefined;

      const data = await vendorService.getAllVendors(search);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({ error: 'Failed to retrieve vendors' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const id = typeof rawId === 'string' ? rawId : rawId?.[0];

      if (!id) {
        res.status(400).json({ error: 'Invalid vendor ID' });
        return;
      }

      const vendor = await vendorService.getVendorById(id);

      if (!vendor) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }

      res.status(200).json(vendor);
    } catch (error) {
      console.error('Error fetching vendor:', error);
      res.status(500).json({ error: 'Failed to retrieve vendor' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const rawId = req.params.id;
      const id = typeof rawId === 'string' ? rawId : rawId?.[0];

      if (!id) {
        res.status(400).json({ error: 'Invalid vendor ID' });
        return;
      }

      const { name, website, description } = req.body;

      if (!name && website === undefined && description === undefined) {
        res.status(400).json({ error: 'At least one field is required to update' });
        return;
      }

      const updated = await vendorService.updateVendor(id, { name, website, description });

      if (!updated) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }

      res.status(200).json(updated);
    } catch (error) {
      console.error('Error updating vendor:', error);
      res.status(500).json({ error: 'Failed to update vendor' });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : rawId?.[0];
    res.status(501).json({ message: `Refresh trigger received for vendor ID: ${id}` });
  }
}

export const vendorController = new VendorController();