const Database = require('better-sqlite3');
const path = require('path');

// Sesuaikan path ini dengan letak instalasi aplikasi Astro kamu di Contabo nanti
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

exports.register = function () {
    this.register_hook('data', 'parse_and_save_email');
};

exports.parse_and_save_email = function (next, connection) {
    connection.transaction.parse_body = true;
    
    connection.transaction.message_stream.on('end', () => {
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
                         if (child.ct.includes('text/plain')) textBody += child.bodytext;
                         if (child.ct.includes('text/html')) htmlBody += child.bodytext;
                     });
                }
            }

            // Cari di database dan insert
            const stmtFind = db.prepare('SELECT id FROM inboxes WHERE email = ? LIMIT 1');
            const stmtInsert = db.prepare('INSERT INTO emails (inbox_id, sender, subject, text_body, html_body) VALUES (?, ?, ?, ?, ?)');
            
            txn.rcpt_to.forEach(recp => {
                const row = stmtFind.get(recp.address());
                if (row) {
                    stmtInsert.run(row.id, fromStr, subjectStr, textBody, htmlBody);
                }
            });
            
            next();
        } catch (err) {
            connection.logerror("Failed to save email to DB: " + err.message);
            next();
        }
    });
};
