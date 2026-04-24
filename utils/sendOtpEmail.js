import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

export async function sendOtpEmail(email, otp) {
  // ✅ STEP 1: Put your HTML template here
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

  // SES
  const params = {
    Source: "no-reply@opentestudox.org",
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Your OTP Code",
      },
      Body: {
        Html: {
          Data: html, 
        },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));
}