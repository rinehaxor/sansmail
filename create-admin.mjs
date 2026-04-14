// Jalankan sekali saja untuk membuat akun admin pertama
// Cara: node create-admin.mjs

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const db = new Database('./database.sqlite');
db.pragma('journal_mode = WAL');

// Pastikan tabel admins ada
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const username = await ask("Masukkan username admin: ");
const password = await ask("Masukkan password admin: ");

const passwordHash = await bcrypt.hash(password, 12);

const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
if (existing) {
  console.log(`\n⚠️  Admin "${username}" sudah ada!`);
  rl.close();
  process.exit(0);
}

db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(username, passwordHash);

console.log(`\n✅ Admin "${username}" berhasil dibuat!`);
console.log(`🔐 Silakan login di: http://localhost:4321/admin/login`);
rl.close();
