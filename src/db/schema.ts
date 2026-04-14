import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const inboxes = sqliteTable('inboxes', {
  id: text('id').primaryKey(), // e.g. pixel123
  email: text('email').notNull().unique(), // pixel123@domain.com
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const emails = sqliteTable('emails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inboxId: text('inbox_id').notNull().references(() => inboxes.id),
  sender: text('sender').notNull(),
  subject: text('subject'),
  textBody: text('text_body'),
  htmlBody: text('html_body'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const authDomains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

