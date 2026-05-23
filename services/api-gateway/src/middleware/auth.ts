import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Fail at startup if JWT_SECRET is not configured — never fall back to a
// hardcoded value in production.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: {
    tenantId: string;
    role: string;
    iat?: number;
    exp?: number;
  };
}

type JwtPayloadShape = {
  tenantId?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

const normalizeRole = (role?: string): string => {
  if (!role) return "";
  if (role === "SUPERADMIN") return "SUPER_ADMIN";
  if (role === "CLIENTOWNER") return "CLIENT_OWNER";
  return role;
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayloadShape;

    if (!decoded?.tenantId || !decoded?.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = {
      tenantId: decoded.tenantId,
      role: normalizeRole(decoded.role),
      ...(decoded.iat !== undefined && { iat: decoded.iat }),
      ...(decoded.exp !== undefined && { exp: decoded.exp }),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const authorizeSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
