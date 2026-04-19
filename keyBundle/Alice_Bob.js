/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import pool from "../Db/db.js";
const key = express.Router();

key.get("/keys/:deviceId", async (req, res) => {
  const { deviceId } = req.params;

  const identity = await pool.query(
    `SELECT public_key FROM identity_keys WHERE device_id = $1`,
    [deviceId]
  );

  const signedPrekey = await pool.query(
    `
    SELECT id, public_key, signature
    FROM signed_prekeys
    WHERE device_id = $1
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [deviceId]
  );

  const oneTime = await pool.query(
    `
    UPDATE one_time_prekeys
    SET used = true
    WHERE id = (
      SELECT id
      FROM one_time_prekeys
      WHERE device_id = $1
      AND used = false
      LIMIT 1
    )
    RETURNING id, public_key
    `,
    [deviceId]
  );

  res.json({
    identityKey: identity.rows[0]?.public_key,
    signedPrekey: signedPrekey.rows[0],
    oneTimePrekey: oneTime.rows[0] || null
  });
});
export default key;
// DELETE FROM one_time_prekeys
// WHERE used = true
// AND created_at < NOW() - INTERVAL '2 days';