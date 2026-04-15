import type { APIRoute } from 'astro';
import { db } from '../../../db/index';
import { emails, inboxes } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ url }) => {
    const inboxId = url.searchParams.get('id');

    if (!inboxId) {
        return new Response(JSON.stringify({ error: 'Missing inbox id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const inbox = await db.select().from(inboxes).where(eq(inboxes.id, inboxId)).limit(1);
    if (inbox.length === 0) {
        return new Response(JSON.stringify({ error: 'Inbox not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const emailList = await db
        .select()
        .from(emails)
        .where(eq(emails.inboxId, inboxId))
        .orderBy(desc(emails.receivedAt));

    return new Response(JSON.stringify({ emails: emailList }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};
