import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';

/** Allows only the listed roles. Must run after authenticate. */
export function requireRoles(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(
        ApiError.forbidden('Your role does not permit this action.', 'ROLE_NOT_ALLOWED'),
      );
    }
    return next();
  };
}

/** Blocks member-portal accounts from staff endpoints. */
export function requireStaff(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === ROLES.MEMBER) {
    return next(ApiError.forbidden('Staff access required.', 'STAFF_ONLY'));
  }
  return next();
}

/** Finance roles (can move money) */
export const requireFinance = requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER);

/** Approver roles for expense workflow */
export const requireExpenseApprover = requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT);

/** General approval roles (savings, expenses, etc.) */
export const requireApprover = requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT);

export default { requireRoles, requireStaff, requireFinance, requireExpenseApprover, requireApprover };
