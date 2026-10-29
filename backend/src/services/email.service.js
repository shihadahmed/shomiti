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

/** Build a Shomiti-branded HTML email shell. */
function mailShell({ subject, preview, title, body, action, actionUrl, footer }) {
  const linkHtml = action && actionUrl
    ? `<div style="margin: 30px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #6B1D2F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; border: 1px solid #6B1D2F; display: inline-block;">
        ${action}
      </a>
    </div>`
    : '';

  return {
    from: config.mail.from,
    to: undefined, // set per call
    subject,
    text: `${preview}\n\n${title}\n\n${body}\n${action ? `${action}: ${actionUrl}` : ''}\n\n---\n${footer}`,
    html: `
      <div style="font-family: 'Hind Siliguri', Inter, sans-serif; color: #2D151B; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2C475; border-radius: 16px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 10px 18px; border-radius: 10px; background: #F7EEDD; border: 1px solid #D4AF37;">
            <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #6B1D2F; text-transform: uppercase;">Shomiti</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 700; color: #6B1D2F; margin: 0 0 16px 0; line-height: 1.35;">${title}</h1>
        ${body.map((p) => `<p style="font-size: 15px; line-height: 1.6; color: #4A3338; margin: 0 0 16px 0;">${p}</p>`).join('')}
        ${linkHtml}
        <p style="font-size: 13px; color: #8A6B5B; margin-top: 30px; padding-top: 16px; border-top: 1px solid #F0E4D2;">${footer}</p>
      </div>
    `,
  };
}

function sendMailWithTracking(mailOptions, { to, subject }) {
  const options = { ...mailOptions, to };
  return new Promise((resolve, reject) => {
    transporter.sendMail(options)
      .then((info) => {
        if (process.env.NODE_ENV === 'test') {
          testOutbox.push({ to, subject: options.subject, text: options.text, html: options.html });
        }
        if (config.mail.transport === 'json') {
          console.log(`[Email Preview] to: ${to}\n${JSON.stringify(info, null, 2)}`);
        }
        resolve({ sent: true, messageId: info.messageId });
      })
      .catch((error) => {
        console.error(`[Email Service] failed to send mail to ${to}:`, error);
        reject(new Error(`Failed to send email: ${error.message}`));
      });
  });
}

/**
 * Sends a "profile submitted / under review" email to the member.
 * @param {Object} options - { to, name }
 */
export async function sendProfileSubmittedEmail({ to, name }) {
  if (!config.mail.enabled) {
    if (config.isLocal) {
      console.log(`[Email Service] Mail disabled. Would have sent profile-submitted email to: ${to}`);
      return { sent: true, preview: 'Mail disabled in config' };
    }
    throw ApiError.internal('Email service is currently disabled.', 'MAIL_DISABLED');
  }

  const options = mailShell({
    subject: 'Your Profile Submission is Under Review',
    preview: `Hello ${name}, we received your profile submission.`,
    title: 'Profile Submitted — Under Review',
    body: [
      `Hello <strong>${name}</strong>,`,
      'Thank you for completing your profile. Your submission has been received and is now under review by our committee.',
      'You will be notified by email and in-app notification once your account is reviewed and approved.',
    ],
    action: 'Go to My Profile',
    actionUrl: `${config.frontendUrl}/complete-profile`,
    footer: `If you did not submit this profile, please contact the cooperative office. © ${new Date().getFullYear()} Shopnonir Somobai Somitee`,
  });

  return sendMailWithTracking(options, { to, subject: options.subject });
}

/**
 * Sends an account approval email to the member.
 * @param {Object} options - { to, name }
 */
export async function sendAccountApprovedEmail({ to, name }) {
  if (!config.mail.enabled) {
    if (config.isLocal) {
      console.log(`[Email Service] Mail disabled. Would have sent account-approved email to: ${to}`);
      return { sent: true, preview: 'Mail disabled in config' };
    }
    throw ApiError.internal('Email service is currently disabled.', 'MAIL_DISABLED');
  }

  const options = mailShell({
    subject: 'Your Account Has Been Approved',
    preview: `Congratulations ${name}, your Shomiti account is now active.`,
    title: 'Account Approved & Verified',
    body: [
      `Congratulations <strong>${name}</strong>!`,
      'Your profile has been reviewed and your account has been verified and approved by the committee.',
      'You now have full access to the Shomiti member portal — savings, dues, payments, statements and more.',
    ],
    action: 'Open Dashboard',
    actionUrl: `${config.frontendUrl}/dashboard`,
    footer: `Thank you for being part of Shopnonir Somobai Somitee. © ${new Date().getFullYear()} Shopnonir Somobai Somitee`,
  });

  return sendMailWithTracking(options, { to, subject: options.subject });
}

/**
 * Sends an account rejection email to the member, including the exact reason.
 * @param {Object} options - { to, name, reason }
 */
export async function sendAccountRejectedEmail({ to, name, reason }) {
  if (!config.mail.enabled) {
    if (config.isLocal) {
      console.log(`[Email Service] Mail disabled. Would have sent account-rejected email to: ${to}`);
      return { sent: true, preview: 'Mail disabled in config' };
    }
    throw ApiError.internal('Email service is currently disabled.', 'MAIL_DISABLED');
  }

  const options = mailShell({
    subject: 'Your Profile Submission Was Not Approved',
    preview: `Hello ${name}, your profile submission could not be approved at this time.`,
    title: 'Profile Submission — Not Approved',
    body: [
      `Hello <strong>${name}</strong>,`,
      'After review, your profile submission could not be approved at this time.',
      `<p style="margin: 16px 0; padding: 14px 18px; border-radius: 10px; background: #FDF3F4; border: 1px solid #FECACA;"><strong style="color: #991B1B;">Reason:</strong> <span style="color: #2D151B;">${reason}</span></p>`,
      'You may update your profile and resubmit it for review from your account dashboard.',
    ],
    action: 'Update Profile',
    actionUrl: `${config.frontendUrl}/complete-profile`,
    footer: `If you have questions, please contact the cooperative office. © ${new Date().getFullYear()} Shopnonir Somobai Somitee`,
  });

  return sendMailWithTracking(options, { to, subject: options.subject });
}
