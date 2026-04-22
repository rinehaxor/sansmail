const Database = require('better-sqlite3');
const path = require('path');

// Sesuaikan path ini dengan letak instalasi aplikasi Astro kamu di Contabo nanti
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Statement yang di-prepare sekali agar efisien
const stmtDomain = db.prepare('SELECT name FROM domains WHERE name = ? LIMIT 1');
const stmtFind   = db.prepare('SELECT id FROM inboxes WHERE email = ? LIMIT 1');
const stmtInsert = db.prepare(
    'INSERT INTO emails (inbox_id, sender, subject, text_body, html_body) VALUES (?, ?, ?, ?, ?)'
);

exports.register = function () {
    // Hook 'rcpt': cek apakah domain penerima terdaftar di database
    this.register_hook('rcpt', 'check_domain');
    // Hook 'data': aktifkan parsing MIME body, lalu langsung panggil next()
    this.register_hook('data', 'enable_body_parse');
    // Hook 'data_post': dipanggil SETELAH semua data diterima & body sudah diparsing
    this.register_hook('data_post', 'save_email');
};

// Cek apakah domain penerima valid (ada di tabel domains di SQLite)
exports.check_domain = function (next, connection, params) {
    const DENY = 5; // Haraka: tolak koneksi
    try {
        const rcpt = params[0];
        const domain = rcpt.host; // bagian setelah '@'

        const row = stmtDomain.get(domain);
        if (!row) {
            connection.loginfo(`[sqlite_inserter] Domain tidak dikenal, reject: ${domain}`);
            return next(DENY, `Domain ${domain} tidak terdaftar.`);
        }

        connection.loginfo(`[sqlite_inserter] Domain valid: ${domain}`);
        next();
    } catch (err) {
        connection.logerror('[sqlite_inserter] Gagal cek domain: ' + err.message);
        next(); // kalau error query, biarkan lanjut (fail-open)
    }
};

exports.enable_body_parse = function (next, connection) {
    connection.transaction.parse_body = true;
    next(); // PENTING: langsung lanjut, jangan tunggu stream
};

exports.save_email = function (next, connection) {
    try {
        const txn = connection.transaction;
        if (!txn) return next();

        const fromStr = txn.mail_from.address();
        const subjectStr = (txn.header.get('subject') || '(No Subject)').trim();
        const body = txn.body;

        let textBody = '';
        let htmlBody = '';

        if (body) {
            if (body.bodytext) textBody = body.bodytext;
            if (body.children) {
                body.children.forEach(child => {
                    if (child.ct && child.ct.includes('text/plain')) textBody += child.bodytext || '';
                    if (child.ct && child.ct.includes('text/html')) htmlBody += child.bodytext || '';
                });
            }
        }

        txn.rcpt_to.forEach(recp => {
            const row = stmtFind.get(recp.address());
            if (row) {
                stmtInsert.run(row.id, fromStr, subjectStr, textBody, htmlBody);
                connection.loginfo(`[sqlite_inserter] Email disimpan untuk ${recp.address()} dari ${fromStr}`);
            } else {
                connection.loginfo(`[sqlite_inserter] Inbox tidak ditemukan untuk ${recp.address()}, dilewati.`);
            }
        });

        next();
    } catch (err) {
        connection.logerror('[sqlite_inserter] Gagal simpan email ke DB: ' + err.message);
        next();
    }
};
