import type { APIRoute } from 'astro';
import { db } from '../../../db/index';
import { admins } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../lib/jwt';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: "Username dan password wajib diisi!" }), { status: 400 });
        }

        const result = await db.select().from(admins).where(eq(admins.username, username)).limit(1);

        if (result.length === 0) {
            return new Response(JSON.stringify({ error: "Username atau password salah!" }), { status: 401 });
        }

        const admin = result[0];
        const isValid = await bcrypt.compare(password, admin.passwordHash);

        if (!isValid) {
            return new Response(JSON.stringify({ error: "Username atau password salah!" }), { status: 401 });
        }

        const token = signToken({ id: admin.id, username: admin.username });

        cookies.set(COOKIE_NAME, token, {
            path: "/",
            maxAge: COOKIE_MAX_AGE,
            httpOnly: true,
            sameSite: "strict",
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
