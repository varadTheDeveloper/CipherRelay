
import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(email, otp) {
  console.log("sendOtpEmail CALLED");

  const html = `<h2>Your OTP is: ${otp}</h2>`;

  try {
    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Your OTP Code",
      html,
    });

    console.log("EMAIL RESPONSE:", response);
  } catch (err) {
    console.error("EMAIL ERROR:", err);
  }
}
