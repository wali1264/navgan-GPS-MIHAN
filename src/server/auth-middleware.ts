/**
 * Authentication & Tenant Authorization Middleware
 */
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../shared/types/enums.js';
import { User } from '../shared/types/models.js';
import { globalStorageRepository } from '../services/storage-repository.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Extract token or header (Support Bearer token and simulated header for demo testing)
  const authHeader = req.headers.authorization;
  const userEmail = req.headers['x-user-email'] as string;

  if (userEmail) {
    const user = globalStorageRepository.getUserByEmail(userEmail);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Default to Super Admin in local development preview if no header provided
  const defaultAdmin = globalStorageRepository.getUserById('usr-admin-01');
  req.user = defaultAdmin;
  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'احراز هویت الزامی است (Unauthorized)' });
      return;
    }

    if (!roles.includes(req.user.role) && req.user.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'عدم دسترسی به این بخش (Forbidden: Insufficient privileges)' });
      return;
    }

    next();
  };
}

export function validateTenantAccess(organizationId: string, customerId?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'احراز هویت الزامی است' });
      return;
    }

    // Super Admin can access all tenants
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Must match organization
    if (req.user.organizationId !== organizationId) {
      res.status(403).json({ error: 'دسترسی غیرمجاز به سازمان دیگر (Tenant violation)' });
      return;
    }

    // If customer role, must match customerId
    if (req.user.role === UserRole.CUSTOMER && customerId && req.user.customerId !== customerId) {
      res.status(403).json({ error: 'دسترسی غیرمجاز به اطلاعات مشتری دیگر (Customer isolation violation)' });
      return;
    }

    next();
  };
}
