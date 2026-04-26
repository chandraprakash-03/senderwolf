import http from 'node:http';
import { logger } from './logger.js';

let capturedEmails = [];
let server = null;
let serverPort = null;

function renderDashboard() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Senderwolf Dev Preview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f4f4f5; display: flex; height: 100vh; overflow: hidden; }
        .sidebar { width: 300px; background: white; border-right: 1px solid #e4e4e7; display: flex; flex-direction: column; }
        .header { padding: 1rem; border-bottom: 1px solid #e4e4e7; background: #fafafa; }
        .header h1 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 8px; }
        .email-list { flex: 1; overflow-y: auto; }
        .email-item { padding: 1rem; border-bottom: 1px solid #e4e4e7; cursor: pointer; }
        .email-item:hover { background: #f4f4f5; }
        .email-item.active { background: #e0e7ff; border-left: 3px solid #4f46e5; }
        .email-subject { font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .email-meta { font-size: 0.8rem; color: #71717a; display: flex; justify-content: space-between; }
        .content { flex: 1; display: flex; flex-direction: column; background: white; }
        .content-header { padding: 1rem; border-bottom: 1px solid #e4e4e7; }
        .tabs { display: flex; gap: 1rem; margin-top: 1rem; border-bottom: 1px solid #e4e4e7; }
        .tab { padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid transparent; color: #71717a; }
        .tab.active { border-bottom-color: #4f46e5; color: #4f46e5; font-weight: 500; }
        .preview-area { flex: 1; position: relative; background: #f8fafc; }
        iframe { width: 100%; height: 100%; border: none; background: white; }
        pre { white-space: pre-wrap; padding: 1rem; margin: 0; font-family: monospace; color: #333; height: 100%; overflow: auto; box-sizing: border-box; }
        .empty-state { display: flex; height: 100%; align-items: center; justify-content: center; color: #71717a; flex-direction: column; }
        .badge { background: #e4e4e7; color: #3f3f46; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="header">
            <h1>🐺 Senderwolf Preview</h1>
        </div>
        <div class="email-list" id="emailList">
            <!-- Populated via JS -->
        </div>
    </div>
    <div class="content">
        <div id="contentHeader" class="content-header" style="display: none;">
            <h2 id="previewSubject" style="margin: 0 0 8px 0;"></h2>
            <div class="email-meta">
                <span id="previewFrom"></span>
                <span id="previewTo"></span>
            </div>
            <div class="tabs">
                <div class="tab active" onclick="switchTab('html')">HTML</div>
                <div class="tab" onclick="switchTab('text')">Text</div>
                <div class="tab" onclick="switchTab('amp')">AMP</div>
                <div class="tab" onclick="switchTab('json')">Raw JSON</div>
            </div>
        </div>
        <div class="preview-area" id="previewArea">
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <p>Select an email to preview</p>
                <small>Waiting for incoming emails in dev mode...</small>
            </div>
        </div>
    </div>

    <script>
        let emails = [];
        let currentEmailId = null;
        let currentTab = 'html';

        async function fetchEmails() {
            try {
                const res = await fetch('/api/emails');
                const newEmails = await res.json();
                
                if (newEmails.length !== emails.length) {
                    emails = newEmails;
                    renderList();
                    
                    // Auto-select newest if none selected
                    if (!currentEmailId && emails.length > 0) {
                        selectEmail(emails[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch emails", e);
            }
        }

        function renderList() {
            const list = document.getElementById('emailList');
            if (emails.length === 0) {
                list.innerHTML = '<div style="padding: 1rem; color: #71717a; text-align: center;">No emails intercepted yet</div>';
                return;
            }
            
            list.innerHTML = emails.map(e => \`
                <div class="email-item \${e.id === currentEmailId ? 'active' : ''}" onclick="selectEmail('\${e.id}')">
                    <div class="email-subject">\${e.subject || '(No Subject)'}</div>
                    <div class="email-meta">
                        <span>To: \${e.to}</span>
                        <span>\${new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style="margin-top: 4px;">
                        \${e.hasHtml ? '<span class="badge">HTML</span>' : ''}
                        \${e.hasAmp ? '<span class="badge">AMP</span>' : ''}
                        \${e.attachments > 0 ? \`<span class="badge">📎 \${e.attachments}</span>\` : ''}
                    </div>
                </div>
            \`).join('');
        }

        window.selectEmail = function(id) {
            currentEmailId = id;
            document.getElementById('contentHeader').style.display = 'block';
            renderList();
            renderPreview();
        }

        window.switchTab = function(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            renderPreview();
        }

        function renderPreview() {
            if (!currentEmailId) return;
            const email = emails.find(e => e.id === currentEmailId);
            if (!email) return;

            document.getElementById('previewSubject').textContent = email.subject || '(No Subject)';
            document.getElementById('previewFrom').textContent = \`From: \${email.from}\`;
            document.getElementById('previewTo').textContent = \`To: \${email.to}\`;

            const area = document.getElementById('previewArea');
            
            if (currentTab === 'html') {
                area.innerHTML = email.hasHtml ? 
                    \`<iframe src="/api/emails/\${email.id}/html"></iframe>\` : 
                    \`<div class="empty-state"><p>No HTML content</p></div>\`;
            } else if (currentTab === 'text') {
                if (email.hasText) {
                    area.innerHTML = '<pre></pre>';
                    area.querySelector('pre').textContent = email.text;
                } else {
                    area.innerHTML = \`<div class="empty-state"><p>No Plain Text content</p></div>\`;
                }
            } else if (currentTab === 'amp') {
                area.innerHTML = email.hasAmp ? 
                    \`<iframe src="/api/emails/\${email.id}/amp"></iframe>\` : 
                    \`<div class="empty-state"><p>No AMP HTML content</p></div>\`;
            } else if (currentTab === 'json') {
                area.innerHTML = '<pre></pre>';
                area.querySelector('pre').textContent = JSON.stringify(email.raw, null, 2);
            }
        }

        // Poll for new emails every 2 seconds
        setInterval(fetchEmails, 2000);
        fetchEmails();
    </script>
</body>
</html>
    `;
}

const MAX_PORT_RETRIES = 10;

function startServer(port = 3000, attempt = 0) {
    if (server) return;

    server = http.createServer((req, res) => {
        // UI Dashboard
        if (req.method === 'GET' && req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(renderDashboard());
            return;
        }

        // Get Metadata List
        if (req.method === 'GET' && req.url === '/api/emails') {
            const list = capturedEmails.map(e => ({
                id: e.id,
                timestamp: e.timestamp,
                subject: e.mailOptions.subject,
                to: Array.isArray(e.mailOptions.to) ? e.mailOptions.to.join(', ') : e.mailOptions.to,
                from: e.mailOptions.fromHeader || e.mailOptions.from,
                hasHtml: !!e.mailOptions.html,
                hasText: !!e.mailOptions.text,
                hasAmp: !!e.mailOptions.amp,
                text: e.mailOptions.text,
                attachments: e.mailOptions.attachments?.length || 0,
                raw: {
                    from: e.mailOptions.from,
                    fromHeader: e.mailOptions.fromHeader,
                    to: e.mailOptions.to,
                    cc: e.mailOptions.cc,
                    bcc: e.mailOptions.bcc,
                    subject: e.mailOptions.subject,
                    priority: e.mailOptions.priority,
                    encoding: e.mailOptions.encoding,
                    date: e.mailOptions.date,
                    messageId: e.mailOptions.messageId,
                    attachments: (e.mailOptions.attachments || []).map(a => ({
                        filename: a.filename,
                        contentType: a.contentType,
                    })),
                }
            })).reverse(); // Newest first
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(list));
            return;
        }

        // Serve raw HTML/AMP
        const match = req.url.match(/^\/api\/emails\/([a-zA-Z0-9-]+)\/(html|amp)$/);
        if (req.method === 'GET' && match) {
            const id = match[1];
            const type = match[2];
            const email = capturedEmails.find(e => e.id === id);
            
            if (email && email.mailOptions[type]) {
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src * data:; font-src *;"
                });
                res.end(email.mailOptions[type]);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            server = null;
            if (attempt < MAX_PORT_RETRIES) {
                startServer(port + 1, attempt + 1);
            } else {
                logger.error(`Dev Server failed: all ports ${port - attempt} through ${port} are in use.`);
            }
        } else {
            logger.error(`Dev Server error: ${e.message}`);
        }
    });

    server.listen(port, '127.0.0.1', () => {
        serverPort = port;
        // Unref the server so it doesn't artificially keep the process alive
        server.unref();
        
        // Log cleanly to terminal with green text for dev mode
        console.log(`\n\x1b[36m🚀 senderwolf (DEV MODE enabled)\x1b[0m`);
        console.log(`\x1b[32m📧 Preview intercepted emails at \x1b[4mhttp://127.0.0.1:${port}\x1b[0m\n`);
    });
}

export async function captureEmail(mailOptions) {
    if (!server) {
        startServer();
    }

    const captureId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    capturedEmails.push({
        id: captureId,
        timestamp: Date.now(),
        mailOptions
    });

    // Cap stored emails to prevent unbounded memory growth (C4 fix)
    while (capturedEmails.length > 100) {
        capturedEmails.shift();
    }

    const displayPort = serverPort || 3000;
    logger.info(`Dev Server intercepted email to ${mailOptions.to}. View at http://localhost:${displayPort}`);

    // Return mock success payload that mimics normal behavior
    return {
        success: true,
        messageId: `<${captureId}@senderwolf.dev>`,
        attempts: 1,
        captured: true
    };
}
