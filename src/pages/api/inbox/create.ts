import type { APIRoute } from 'astro';
import { db } from '../../../db/index';
import { inboxes, authDomains } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { username, domain } = await request.json();

        if (!username || !domain) {
            return new Response(JSON.stringify({ error: 'Username dan domain wajib diisi.' }), { status: 400 });
        }

        // Hanya huruf, angka, titik, strip, underscore
        if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
            return new Response(JSON.stringify({ error: 'Username hanya boleh mengandung huruf, angka, titik, strip, atau underscore.' }), { status: 400 });
        }

        // Validasi domain ada di DB
        const domainResult = await db.select().from(authDomains).where(eq(authDomains.name, domain)).limit(1);
        if (domainResult.length === 0) {
            return new Response(JSON.stringify({ error: 'Domain tidak valid.' }), { status: 400 });
        }

        const email = `${username}@${domain}`;
        // ID unik dari kombinasi username + domain (replace . jadi -)
        const inboxId = `${username.toLowerCase()}-at-${domain.replace(/\./g, '-')}`;

        // Cek apakah email sudah ada
        const existing = await db.select().from(inboxes).where(eq(inboxes.email, email)).limit(1);
        if (existing.length > 0) {
            return new Response(JSON.stringify({ id: existing[0].id, existed: true }), { status: 200 });
        }

        // Buat inbox baru
        await db.insert(inboxes).values({ id: inboxId, email });

        return new Response(JSON.stringify({ id: inboxId, existed: false }), { status: 201 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
