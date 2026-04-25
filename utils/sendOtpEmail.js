import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(email, otp) {
  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; background:#f5f7fb; font-family: Arial;">
    <div style="max-width:420px; margin:auto; background:#fff; padding:30px; border-radius:12px;">
      
      <h2 style="text-align:center;">CipherRelay</h2>
      
      <p style="text-align:center; color:#555;">
        Your verification code is:
      </p>

      <div style="text-align:center; margin:20px 0;">
        <span style="
          font-size:28px;
          letter-spacing:6px;
          font-weight:bold;
          color:#4f46e5;
        ">
          ${otp}
        </span>
      </div>

      <p style="text-align:center; font-size:12px; color:#888;">
        Expires in 5 minutes. Do not share this code.
      </p>

    </div>
  </body>
  </html>
  `;

  await resend.emails.send({
    from: "onboarding@resend.dev", // temporary sender
    to: email,
    subject: "Your OTP Code",
    html: html,
  });
}
