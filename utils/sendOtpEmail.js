
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(email, otp) {
  console.log("sendOtpEmail CALLED");

  const html = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; padding: 30px; text-align: center;">
      
      <h1 style="color: #333;">🔐 Verify Your Account</h1>
      
      <p style="color: #555; font-size: 16px;">
        Use the OTP below to complete your login.
      </p>

      <div style="
        margin: 30px 0;
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 6px;
        color: #2d89ff;
        background: #f0f6ff;
        padding: 15px;
        border-radius: 8px;
      ">
        ${otp}
      </div>

      <p style="color: #888; font-size: 14px;">
        ⏳ This OTP will expire in <b>5 minutes</b>.
      </p>

      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        If you didn’t request this, you can safely ignore this email.
      </p>

    </div>
  </div>
  `;

  try {
    const response = await resend.emails.send({
      from: "OpenTestudox <auth@opentestudox.org>", // ✅ IMPORTANT FIX
      to: email,
      subject: "Your OTP Code (Valid for 5 minutes)",
      html,
    });

    console.log("EMAIL RESPONSE:", response);
    return response;
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    throw err;
  }
}
