
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

/**
 * Send OTP to a phone number
 * @param {string} phone - E.164 format e.g. +917083642916
 */
const sendOTP = async (phone) => {
  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: phone, channel: 'sms' });
  return verification.sid;
};

/**
 * Verify OTP code entered by user
 * @param {string} phone - E.164 format
 * @param {string} code  - 6-digit OTP
 */
const verifyOTP = async (phone, code) => {
  const result = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: phone, code });
  return result.status === 'approved';
};

module.exports = { sendOTP, verifyOTP };
