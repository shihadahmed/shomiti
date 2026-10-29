import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/auth.validator.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.countUnread);
router.patch('/:id/read', idParam, validate, notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
