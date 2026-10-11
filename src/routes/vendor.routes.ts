import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller.js';
import { refreshRateLimit } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.get('/', (req, res) => vendorController.list(req, res));
router.get('/:id', (req, res) => vendorController.getById(req, res));
router.put('/:id', (req, res) => vendorController.update(req, res));
router.post('/:id/refresh', refreshRateLimit, (req, res) => vendorController.refresh(req, res));

export default router;
