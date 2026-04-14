import jwt from 'jsonwebtoken';

const JWT_SECRET = import.meta.env.JWT_SECRET || "fallback_secret_dev";
const COOKIE_NAME = "admin_jwt";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day in seconds

export function signToken(payload: { id: number; username: string }) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: COOKIE_MAX_AGE });
}

export function verifyToken(token: string): { id: number; username: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    } catch {
        return null;
    }
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
