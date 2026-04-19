/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import { auth } from "../index.js";
import pool from "../Db/db.js";
const router = express.Router();
router.post("/identity", auth, async (req, res) => {
  console.log("running");

  const { publicKey } = req.body;
  console.log(publicKey);
  await pool.query(
    `
    INSERT INTO identity_keys (device_id, public_key)
    VALUES ($1, $2)
    ON CONFLICT (device_id) DO NOTHING
    `,
    [req.deviceId, publicKey],
  );

  res.json({ success: true });
});

router.get("/signed-prekey/latest", auth, async (req, res) => {
  const { rows } = await pool.query(
    `
        SELECT public_key, expires_at
        FROM signed_prekeys
        WHERE  device_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
    [req.deviceId],
  );
  if (!rows.length) {
    return res.json(null);
  }
  res.json({ ok: rows[0],  });
});
router.post("/signed-prekey", auth, async (req, res) => {
  const { publicKey, signature, expiresAt } = req.body;
  if (!publicKey || !signature || !expiresAt) {
    return res.status(400).json({ error: "Invalid signed prekey" });
  }
  await pool.query(
    `
    INSERT INTO signed_prekeys
     (device_id, public_key, signature, expires_at)
     VALUES ($1,$2,$3,$4)
    `,
    [req.deviceId, publicKey, signature, expiresAt],
  );
  res.json({ success: true });
});
router.get("/one-time-prekeys/status", auth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT COUNT(*) AS  unused
FROM one_time_prekeys
WHERE device_id = $1
AND used = false
    `,
    [req.deviceId],
  );
  res.json({
    unused: Number(rows[0].unused),
  });
});

router.post("/one-time-prekeys", auth, async (req, res) => {
  const { prekeys } = req.body;
  // 1️⃣ Validate input
  if (!Array.isArray(prekeys) || prekeys.length === 0) {
    return res.status(400).json({ error: "Invalid prekeys array" });
  }
  // 2️⃣ Insert ALL prekeys safely (no SQL injection)
  await pool.query(
    `
    INSERT INTO one_time_prekeys (device_id, public_key)
    SELECT $1, unnest($2::text[])
    `,
    [req.deviceId, prekeys],
  );
  res.json({ success: true });
});
export default router;
