const Database = require('better-sqlite3');
const path = require('path');

// Sesuaikan path ini dengan letak instalasi aplikasi Astro kamu di Contabo nanti
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

exports.register = function () {
    // Hook 'data': aktifkan parsing MIME body, lalu langsung panggil next()
    this.register_hook('data', 'enable_body_parse');
    // Hook 'data_post': dipanggil SETELAH semua data diterima & body sudah diparsing
    this.register_hook('data_post', 'save_email');
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

        // Cari di database dan insert
        const stmtFind = db.prepare('SELECT id FROM inboxes WHERE email = ? LIMIT 1');
        const stmtInsert = db.prepare(
            'INSERT INTO emails (inbox_id, sender, subject, text_body, html_body) VALUES (?, ?, ?, ?, ?)'
        );

        txn.rcpt_to.forEach(recp => {
            const row = stmtFind.get(recp.address());
            if (row) {
                stmtInsert.run(row.id, fromStr, subjectStr, textBody, htmlBody);
                connection.loginfo(`Email saved for ${recp.address()} from ${fromStr}`);
            } else {
                connection.loginfo(`No inbox found for ${recp.address()}, skipping.`);
            }
        });

        next();
    } catch (err) {
        connection.logerror('Failed to save email to DB: ' + err.message);
        next();
    }
};
