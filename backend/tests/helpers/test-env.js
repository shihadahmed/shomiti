/**
 * Environment overrides for the test suite. Imported first (before anything that
 * pulls in `config/env.js`) so these win over the values in `.env` — dotenv never
 * overwrites variables that are already set.
 *
 * MAIL_TRANSPORT=json keeps nodemailer fully offline; the captured messages are
 * published through `testOutbox` in `services/email.service.js`.
 */
process.env.NODE_ENV = 'test';
process.env.MAIL_ENABLED = 'true';
process.env.MAIL_TRANSPORT = 'json';
process.env.BCRYPT_ROUNDS = '4';
