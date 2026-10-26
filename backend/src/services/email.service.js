import nodemailer from 'nodemailer';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Email service for system notifications and user invitations.
 * Supports SMTP for production and JSON transport for local development preview.
 */

// Test-only outbox to verify emails in integration tests
export const testOutbox = [];

const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: config.mail.user ? {
    user: config.mail.user,
    pass: config.mail.pass,
  } : undefined,
  // Enable JSON transport for local development logs/previews
  jsonTransport: config.mail.transport === 'json',
});

/**
 * Sends a password setup invitation email to a new user.
 * @param {Object} options - { to, name, token }
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendInviteEmail({ to, name, token }) {
  if (!config.mail.enabled) {
    if (config.isLocal) {
      console.log(`[Email Service] Mail disabled. Would have sent invite to: ${to}`);
      return { sent: true, preview: 'Mail disabled in config' };
    }
    throw ApiError.internal('Email service is currently disabled.', 'MAIL_DISABLED');
  }

  const setupLink = `${config.frontendUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: config.mail.from,
    to,
    subject: 'Welcome to Shomiti - Set Up Your Account',
    text: `Hello ${name},\n\nWelcome to Shomiti! Please set up your account password by clicking the link below:\n\n${setupLink}\n\nThis link will expire in ${config.mail.inviteTtlHours} hours.`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #C5A059;">Welcome to Shomiti!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your account has been created. To get started, please set up your secure password using the link below:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${setupLink}" style="background-color: #C5A059; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Set Up Password
          </a>
        </div>
        <p>This link will expire in ${config.mail.inviteTtlHours} hours.</p>
        <p style="font-size: 12px; color: #888; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          ${setupLink}
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Store in test outbox for verification in tests
    if (process.env.NODE_ENV === 'test') {
      testOutbox.push({ to, subject: mailOptions.subject, text: mailOptions.text, html: mailOptions.html });
    }

    if (config.mail.transport === 'json') {
      console.log(`[Email Preview] to: ${to}\n${JSON.stringify(info, null, 2)}`);
    }
    
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Service] failed to send mail to ${to}:`, error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}

export default {
  sendInviteEmail,
};
