/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import http from "http";
import crypto from "crypto";

const server = http.createServer((req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");

  // Set CSP header with nonce
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'`
  );

  // Send HTML with same nonce
  res.end(`
    <html>
      <body>
        <h1>Hello</h1>

        <script nonce="${nonce}">
          console.log("SAFE script running");
        </script>

      </body>
    </html>
  `);
});

server.listen(3002);