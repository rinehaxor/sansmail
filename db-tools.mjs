import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(resolve(__dirname, 'database.sqlite'));

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
    case 'status': {
        console.log('\n=== DOMAINS ===');
        console.log(db.prepare('SELECT * FROM domains').all());
        console.log('\n=== INBOXES (5 terbaru) ===');
        console.log(db.prepare('SELECT * FROM inboxes ORDER BY created_at DESC LIMIT 5').all());
        console.log('\n=== EMAILS ===');
        console.log('Total:', db.prepare('SELECT COUNT(*) as c FROM emails').get());
        console.log('5 terbaru:', db.prepare('SELECT id, inbox_id, sender, subject, received_at FROM emails ORDER BY id DESC LIMIT 5').all());
        break;
    }
    case 'add-domain': {
        if (!arg) { console.error('Usage: node db-tools.mjs add-domain <nama-domain>'); process.exit(1); }
        db.prepare('INSERT OR IGNORE INTO domains (name) VALUES (?)').run(arg);
        console.log('Domain ditambahkan:', db.prepare('SELECT * FROM domains').all());
        break;
    }
    case 'clear-emails': {
        const count = db.prepare('SELECT COUNT(*) as c FROM emails').get();
        db.prepare('DELETE FROM emails').run();
        console.log(`Berhasil hapus ${count.c} email dari database.`);
        break;
    }
    case 'clear-inboxes': {
        const count = db.prepare('SELECT COUNT(*) as c FROM inboxes').get();
        db.prepare('DELETE FROM emails').run();  // hapus dulu emails (foreign key)
        db.prepare('DELETE FROM inboxes').run();
        console.log(`Berhasil hapus ${count.c} inbox (+ semua email-nya) dari database.`);
        break;
    }
    default: {
        console.log(`
Penggunaan:
  node db-tools.mjs status              - Lihat isi database
  node db-tools.mjs add-domain <domain> - Tambah domain (contoh: puskanda.site)
  node db-tools.mjs clear-emails        - Hapus semua email masuk
  node db-tools.mjs clear-inboxes       - Hapus semua inbox + email
        `);
    }
}
