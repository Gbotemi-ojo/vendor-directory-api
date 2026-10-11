import { Request, Response } from 'express';
import { z } from 'zod';
import { vendorService } from '../services/vendor.service.js';
import {
  UpdateVendorBodySchema,
  VendorIdParamSchema,
  VendorListQuerySchema,
} from '../schemas/vendor.schema.js';

export class VendorController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { search } = VendorListQuerySchema.parse(req.query);
      const data = await vendorService.getAllVendors(search);
      res.status(200).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input data', details: error.issues });
        return;
      }
      console.error('Error fetching vendors:', error);
      res.status(500).json({ error: 'Failed to retrieve vendors' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = VendorIdParamSchema.parse(req.params);
      const vendor = await vendorService.getVendorById(id);

      if (!vendor) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }

      res.status(200).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input data', details: error.issues });
        return;
      }
      console.error('Error fetching vendor:', error);
      res.status(500).json({ error: 'Failed to retrieve vendor' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = VendorIdParamSchema.parse(req.params);
      const update = UpdateVendorBodySchema.parse(req.body);
      const updated = await vendorService.updateVendor(id, update);

      if (!updated) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }

      res.status(200).json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input data', details: error.issues });
        return;
      }
      console.error('Error updating vendor:', error);
      res.status(500).json({ error: 'Failed to update vendor' });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { id } = VendorIdParamSchema.parse(req.params);
      const refreshedVendor = await vendorService.refreshVendor(id);
      res.status(200).json(refreshedVendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input data', details: error.issues });
        return;
      }
      console.error('Error refreshing vendor:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to refresh vendor data',
      });
    }
  }
}

export const vendorController = new VendorController();
