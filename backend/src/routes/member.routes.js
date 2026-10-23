import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requireStaff } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadSingle } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';
import {
  createMemberRules,
  updateMemberRules,
  listMemberRules,
  memberIdParam,
} from '../validators/member.validator.js';
import * as memberController from '../controllers/member.controller.js';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', listMemberRules, validate, memberController.listMembers);
router.get('/options', memberController.memberOptions);
router.post(
  '/',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  createMemberRules,
  validate,
  memberController.createMember,
);

router.get('/:id/transactions', memberIdParam, validate, memberController.getMemberTransactions);
router.get('/:id/photo', memberIdParam, validate, memberController.downloadPhoto);
router.post(
  '/:id/photo',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  uploadSingle('photo'),
  memberIdParam,
  validate,
  memberController.uploadPhoto,
);
router.get('/:id', memberIdParam, validate, memberController.getMember);
router.patch(
  '/:id',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  updateMemberRules,
  validate,
  memberController.updateMember,
);
router.delete(
  '/:id',
  requireRoles(ROLES.SUPER_ADMIN),
  memberIdParam,
  validate,
  memberController.deleteMember,
);

export default router;
