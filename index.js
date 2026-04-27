/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import cookieParser from "cookie-parser";
// import { hashToken } from "./Register/verifyOTP.js";
import requestOtp from "./Register/requestOtp.js";
import verifyOTP from "./Register/verifyOTP.js";
import router from "./routes/keys.js";
import pool from "./Db/db.js";
import key from "./keyBundle/Alice_Bob.js";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const port = 3000;
const allowedOrigins = ["http://localhost:5173","https://app.opentestudox.org","https://web.opentestudox.org"];
app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // allow no-origin (curl, mobile apps, etc.)
  if (!origin) {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-sender-id"
  );

  res.setHeader("Access-Control-Allow-Credentials", "true");

  // handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
export async function auth(req, res, next) {
  const token = req.cookies.session;
  

  if (!token) return res.sendStatus(401);

  const { rows } = await pool.query(
    `
SELECT s.user_id, s.device_id, d.revoked
FROM sessions s
JOIN devices d ON d.id = s.device_id
WHERE s.token_hash = $1
AND  s.expires_at > NOW()
    `,
    [token],
  );
 
  if (!rows.length) return res.sendStatus(401);
  if (rows[0].revoked) return res.sendStatus(401);
 
  req.userId = rows[0].user_id;
  req.deviceId = rows[0].device_id;
  next();
}
/* ---------- PUBLIC ROUTES (NO AUTH) ---------- */
app.use("/auth", requestOtp); // request OTP
app.use("/otp", verifyOTP); // verify OTP
app.use("/keys", router); // keys
app.use("/conversations", router);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

/* ---------- AUTH MIDDLEWARE ---------- */
app.use(auth);
/* ---------- PROTECTED ROUTES ---------- */
// app.use("/devices", devicesRouter);
// app.use("/messages", messagesRouter);

app.use(
  "/bundle",
  (req, res, next) => {
   
    next();
  },
  key,
);

app.get("/device/:identityKey", async (req, res) => {
  const identityKey = req.params.identityKey;

  try {
    const result = await pool.query(
      `
      SELECT d.id AS device_id
      FROM identity_keys ik
      JOIN devices d ON d.id = ik.device_id
      WHERE ik.public_key = $1
      AND d.revoked = FALSE
      LIMIT 1
    `,
      [identityKey],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "device not found",
      });
    }

    res.json({
      device_id: result.rows[0].device_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("server error");
  }
});
app.post("/identity-confirm", async (req, res) => {
  const { from_identity, receiver_device_id, type } = req.body;

  try {
    await pool.query(
      `
      INSERT INTO device_inbox
      (receiver_device_id, sender_identity_key, type, payload)
      VALUES ($1,$2,$3,$4)
    `,
      [receiver_device_id, from_identity, type, req.body],
    );

    res.json({
      status: "stored",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("server error");
  }
});
app.get("/device-inbox/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const result = await pool.query(
      `
      SELECT id, type, payload, created_at
      FROM device_inbox
      WHERE receiver_device_id = $1
      ORDER BY created_at ASC
    `,
      [deviceId],
    );

    res.json({
      messages: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("server error");
  }
});
app.post("/message", async (req, res) => {
  const { receiver_device_id, sender_device_id, message_type, envelope } =
    req.body;

  if (!receiver_device_id || !envelope) {
    return res.status(400).json({ error: "Invalid message" });
  }

  await db.query(
    `
    INSERT INTO device_inbox_msg
    (receiver_device_id, sender_device_id, message_type, envelope)
    VALUES ($1,$2,$3,$4)
  `,
    [receiver_device_id, sender_device_id, message_type, envelope],
  );

  res.json({ status: "stored" });
});
app.get("/device-inbox/:deviceId", async (req, res) => {
  const { deviceId } = req.params;

  const result = await db.query(
    `
    SELECT id, sender_device_id, message_type, envelope, created_at
    FROM device_inbox_msg
    WHERE receiver_device_id = $1
    ORDER BY created_at ASC
  `,
    [deviceId],
  );

  res.json({ messages: result.rows });
});

// await db.query(
//   `INSERT INTO device_inbox_msg_bin
//    (receiver_device_id, sender_device_id, message_type, envelope)
//    VALUES ($1, $2, $3, $4)`,
//   [
//     receiverId,
//     senderId,
//     "message",
//   arrayBuffer // 🔥 important
//   ]
// );
app.post("/send-message", async (req, res) => {
  const { deviceId } = req.params;

  const senderId = req.headers["x-sender-id"];
  const receiverId = req.query.receiverId;
  const device = await pool.query("SELECT id FROM devices WHERE id = $1", [
    receiverId,
  ]);

  if (device.rowCount === 0) {
    return res.status(404).json({ error: "unavailable" });
  }
  const chunks = [];

  req.on("data", (c) => chunks.push(c));

  req.on("end", async () => {
    const buffer = Buffer.concat(chunks);

    const result = await pool.query(
      `INSERT INTO device_inbox_msg_bin
       (receiver_device_id, sender_device_id, message_type, envelope)
       VALUES ($1, $2, $3, $4)
       RETURNING id
       `,
      [receiverId, senderId, "message", buffer],
    );

    res.json({ id: result.rows[0].id });
  });
});
app.get("/next-message/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
 
  //   // 🔹 Check device exists
  //   const device = await pool.query(
  //     "SELECT id FROM devices WHERE id = $1",
  //     [deviceId]
  //   );
  // console.log("devide",device)
  //   if (device.rowCount === 0) {

  //     return res.status(404).end();
  //   }
  const result = await pool.query(
    `SELECT id, envelope
     FROM device_inbox_msg_bin
     WHERE receiver_device_id = $1
       AND delivered_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    [deviceId],
  );

  if (result.rows.length === 0) {
    return res.status(204).end();
  }

  const row = result.rows[0];

  // mark delivered
  await pool.query(
    `UPDATE device_inbox_msg_bin
     SET delivered_at = NOW()
     WHERE id = $1`,
    [row.id],
  );

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("x-message-id", row.id);

  res.send(row.envelope);
});
app.post("/seen", async (req, res) => {
  const { id } = req.body;

  await pool.query(
    `UPDATE device_inbox_msg_bin
     SET seen_at = NOW()
     WHERE id = $1`,
    [id],
  );

  res.send("ok");
});
app.get("/message-status/:id", async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT delivered_at, seen_at
     FROM device_inbox_msg_bin
     WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "not found" });
  }

  res.json(result.rows[0]);
});
app.get("/hi", (req, res) => {
  res.send("<h1>Hello</h1>");
});
app.post("/auth/logout", async (req, res) => {
  const tokenHash = hashToken(req.cookies.session);
  await pool.query(
    `
    DELETE FROM sessions WHERE  token_hash = $1`,
    [tokenHash],
  );
  res.clearCookie("session");
  res.json({ success: true });
});
app.post("/profile", async (req, res) => {
  const { identity_key, encrypted_profile } = req.body;

  if (!identity_key || !encrypted_profile) {
    return res.status(400).json({ error: "Invalid data" });
  }

  await db.query(
    `
    INSERT INTO profiles (identity_key, encrypted_profile)
    VALUES ($1, $2)
    ON CONFLICT (identity_key)
    DO UPDATE SET
      encrypted_profile = $2,
      updated_at = NOW()
  `,
    [identity_key, encrypted_profile],
  );

  res.json({ status: "stored" });
});
app.get("/profile/:identityKey", async (req, res) => {
  const { identityKey } = req.params;

  const result = await db.query(
    `
    SELECT encrypted_profile
    FROM profiles
    WHERE identity_key = $1
  `,
    [identityKey],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({
    encrypted_profile: result.rows[0].encrypted_profile,
  });
});

app.post("/devices/:id/revoke", async (req, res) => {
  // POST /devices/d2/revoke
  const { id } = req.params;
  await pool.query(
    `
    UPDATE devices
    SET revoked = true
    WHERE id = $1
    AND user_id = $2
    `,
    [id, req.userId],
  );
  res.json({ success: true });
});
app.get("/devices", async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT  id, device_name, revoked, created_at
    FROM devices
    WHERE  user_id = $1
  ORDER BY created_at DESC
    `,
    [req.userId],
  );
  res.json({ devices: rows });
});

// POST /device/revoke

app.post("/device/revoke", async (req, res) => {
  const tokenHash = req.cookies.session;

  if (!tokenHash) {
    return res.status(401).json({ error: "No session" });
  }

  const { rows } = await pool.query(
    `SELECT device_id FROM sessions
     WHERE token_hash = $1
     AND expires_at > NOW()`,
    [tokenHash],
  );

  if (!rows.length) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const deviceId = rows[0].device_id;

  await pool.query(`UPDATE devices SET revoked = true WHERE id = $1`, [
    deviceId,
  ]);

  await pool.query(`DELETE FROM sessions WHERE device_id = $1`, [deviceId]);

  res.clearCookie("session");

  res.json({ success: true });
});

// DELETE FROM signed_prekeys WHERE device_id = $deviceId;
// DELETE FROM one_time_prekeys WHERE device_id = $deviceId;
// DELETE FROM sessions WHERE device_id = $deviceId;

app.delete("/user/me", async (req, res) => {
  const userId = req.userId;

  try {
    await pool.query("BEGIN");

    // delete user (cascade will handle rest)
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await pool.query("COMMIT");

    // clear cookie/session
    // res.clearCookie("auth");

    res.clearCookie("session");
    res.send({ success: true });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Failed to delete account");
  }
});

app.get("/user/export", async (req, res) => {
  const userId = req.userId;

  try {
    // 🔹 User
    const user = await pool.query(
      "SELECT id, email, created_at FROM users WHERE id = $1",
      [userId],
    );

    // 🔹 Devices
    const devices = await pool.query(
      "SELECT id, device_name, created_at, last_seen FROM devices WHERE user_id = $1",
      [userId],
    );

    const deviceIds = devices.rows.map((d) => d.id);

    // 🔹 Sessions
    const sessions = await pool.query(
      "SELECT id, device_id, expires_at, created_at FROM sessions WHERE user_id = $1",
      [userId],
    );

    // 🔹 Messages (encrypted only)

    const messages = await pool.query(
      `SELECT 
     id,
     sender_device_id,
     receiver_device_id,
     message_type,
     envelope,
     created_at
   FROM device_inbox_msg_bin
   WHERE receiver_device_id = ANY($1)`,
      [deviceIds],
    );

    // 🔥 convert envelope
    const safeMessages = messages.rows.map((m) => ({
      ...m,
      envelope: m.envelope.toString("base64"), // ✅ IMPORTANT
    }));
    // 🔹 Keys (optional but important)
    const identityKeys = await pool.query(
      `SELECT device_id, public_key, created_at 
       FROM identity_keys WHERE device_id = ANY($1)`,
      [deviceIds],
    );

    const exportData = {
      user: user.rows[0],
      devices: devices.rows,
      sessions: sessions.rows,
      messages: safeMessages,
      identity_keys: identityKeys.rows,
    };

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=server-data.json",
    );

    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Export failed");
  }
});

app.post("/logout", async (req, res) => {
  try {
    res.clearCookie("session");
    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Logout failed");
  }
});
app.get("/me", async (req, res) => {
  res.json({
    userId: req.userId,
    deviceId: req.deviceId,
  });
});
app.get("/exmaple", async (req, res) => {
  res.end(`
    <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=visibility_off"
    />

    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=visibility"
    />

    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ui</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);
});
// server
app.listen(port, () => {
  console.log("Server running");

  // 🔥 cleanup job
  setInterval(
    async () => {
      console.log("Running cleanup...");

      await pool.query(`
      DELETE FROM device_inbox_msg_bin
      WHERE seen_at IS NOT NULL
        AND seen_at < NOW() - INTERVAL '7 days'
    `);
    },
    1000 * 60 * 60,
  );
});
