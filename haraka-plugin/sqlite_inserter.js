const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

// Path database untuk domain & inbox check saja
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Hanya untuk cek domain (read-only)
const stmtDomain = db.prepare('SELECT name FROM domains WHERE name = ? LIMIT 1');

// URL Astro app untuk simpan email via webhook
const ASTRO_PORT = process.env.ASTRO_PORT || '4321';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'haraka-internal';

function postToWebhook(data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: '127.0.0.1',
            port: parseInt(ASTRO_PORT),
            path: '/api/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-Webhook-Secret': WEBHOOK_SECRET,
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(responseData)); }
                catch (e) { resolve({ raw: responseData }); }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Webhook timeout after 10s'));
        });

        req.write(body);
        req.end();
    });
}

exports.register = function () {
    this.register_hook('rcpt', 'check_domain');
    this.register_hook('data', 'enable_body_parse');
    this.register_hook('data_post', 'save_email');
};

// Cek apakah domain penerima terdaftar
exports.check_domain = function (next, connection, params) {
    const OK = 906;   // Haraka v3: terima recipient
    const DENY = 901; // Haraka v3: tolak recipient
    try {
        const rcpt = params[0];
        const domain = rcpt.host;

        const row = stmtDomain.get(domain);
        if (!row) {
            connection.loginfo(`[sqlite_inserter] Domain tidak dikenal, reject: ${domain}`);
            return next(DENY, `Domain ${domain} tidak terdaftar.`);
        }

        connection.loginfo(`[sqlite_inserter] Domain valid: ${domain}`);
        next(OK); // PENTING: harus next(OK) bukan next() agar Haraka tidak reject dengan 550
    } catch (err) {
        connection.logerror('[sqlite_inserter] Gagal cek domain: ' + err.message);
        next(OK); // fail-open: tetap terima
    }
};

exports.enable_body_parse = function (next, connection) {
    connection.transaction.parse_body = true;
    next();
};

// Simpan email via HTTP POST ke Astro webhook
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

        const promises = txn.rcpt_to.map(recp => {
            const toAddress = recp.address();
            return postToWebhook({
                to: toAddress,
                from: fromStr,
                subject: subjectStr,
                textBody,
                htmlBody,
            }).then(result => {
                connection.loginfo(`[sqlite_inserter] Email disimpan untuk ${toAddress}: ${JSON.stringify(result)}`);
            }).catch(err => {
                connection.logerror(`[sqlite_inserter] Gagal simpan email untuk ${toAddress}: ${err.message}`);
            });
        });

        Promise.all(promises)
            .then(() => next())
            .catch(() => next());

    } catch (err) {
        connection.logerror('[sqlite_inserter] Error di save_email: ' + err.message);
        next();
    }
};
