import type { APIRoute } from 'astro';
import { db } from '../../db/index';
import { emails, inboxes } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        
        // Ensure destination email exists in our records
        const inboxResult = await db.select().from(inboxes).where(eq(inboxes.email, body.to)).limit(1);
        
        if (inboxResult.length === 0) {
            return new Response(JSON.stringify({ error: "Inbox not found" }), { status: 404 });
        }

        // Insert mock email
        await db.insert(emails).values({
            inboxId: inboxResult[0].id,
            sender: body.from,
            subject: body.subject,
            textBody: body.textBody,
            htmlBody: body.htmlBody,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
