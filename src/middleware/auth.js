import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = header.slice(7);
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive account' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireMinRole(minRole) {
  const hierarchy = { superadmin: 3, manager: 2, agent: 1 };
  return (req, res, next) => {
    if (!req.user || (hierarchy[req.user.role] || 0) < (hierarchy[minRole] || 0)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export async function authenticateStream(req, res, next) {
  try {
    const header = req.headers.authorization;
    const queryToken = req.query.token;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : queryToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive account' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
