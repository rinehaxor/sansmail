import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../../lib/jwt';

export const POST: APIRoute = async ({ cookies }) => {
    cookies.delete(COOKIE_NAME, { path: "/" });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
};
