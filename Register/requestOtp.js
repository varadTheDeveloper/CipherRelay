/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import crypto from "crypto";
import pool from "../Db/db.js";
import rateLimit from "express-rate-limit";
import { sendOtpEmail } from "../utils/sendOtpEmail.js";

const requestOtp = express.Router();
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 requests per IP
  message: {
    error: "Too many accounts created from this IP, try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

requestOtp.post("/user", registerLimiter, async (req, res) => {
  let { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  // ✅ Normalize on backend (MANDATORY)
  email = email.trim().toLowerCase();

  const otp = generateOTP();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    `
    INSERT INTO email_otps (email, otp_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [email, otpHash, expiresAt]
  );

  console.log("OTP:", otp);
await sendOtpEmail(email, otp);
  res.json({ success: true });
});

export default requestOtp;