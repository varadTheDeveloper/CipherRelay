/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import crypto from "crypto";
import pool from "../Db/db.js";

const verifyOTP = express.Router();

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

verifyOTP.post("/user", async (req, res) => {
  let { otp, email, deviceId, deviceName } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP required" });
  }

  // ✅ Normalize email (MANDATORY)
  email = email.trim().toLowerCase();
  // 🔹 1. Verify OTP
  const otpHash = hashOtp(otp);

  const { rows } = await pool.query(
    `SELECT * FROM email_otps
     WHERE email = $1
     AND used = false
     AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.status(400).json({ error: "OTP expired or invalid" });
  }

  const record = rows[0];

  if (record.attempts >= 5) {
    return res.status(429).json({ error: "Too many attempts" });
  }

  if (record.otp_hash !== otpHash) {
    await pool.query(
      `UPDATE email_otps 
       SET attempts = attempts + 1 
       WHERE id = $1`,
      [record.id]
    );
    return res.status(400).json({ error: "Invalid OTP" });
  }

  await pool.query(
    `UPDATE email_otps SET used = true WHERE id = $1`,
    [record.id]
  );

  // 🔹 2. Create or fetch user
  let user;

  const userRes = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  if (userRes.rows.length === 0) {
    const created = await pool.query(
      `INSERT INTO users (email, email_verified)
       VALUES ($1, true)
       RETURNING id`,
      [email]
    );
    user = created.rows[0];
  } else {
    user = userRes.rows[0];
  }

  // 🔹 3. Device handling
  let finalDeviceId = deviceId;

  if (!deviceId) {
    const result = await pool.query(
      `INSERT INTO devices (user_id, device_name)
       VALUES ($1, $2)
       RETURNING id`,
      [user.id, deviceName || "Unknown Device"]
    );
    finalDeviceId = result.rows[0].id;
  } else {
    const check = await pool.query(
      `SELECT id FROM devices
       WHERE id = $1
       AND user_id = $2
       AND revoked = false`,
      [deviceId, user.id]
    );

    if (!check.rows.length) {
      return res.status(401).json({ error: "Invalid device" });
    }
  }

  // 🔹 4. Issue session
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO sessions (user_id, device_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, finalDeviceId, tokenHash, expiresAt]
  );

  res.cookie("session", tokenHash, {
    httpOnly: true,
    secure: false, // true in production
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    userId: user.id,
    deviceId: finalDeviceId,
  });
});

export default verifyOTP;