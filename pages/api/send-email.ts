import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

// Hard-coded SMTP credentials for Hostinger
const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'info@closecheckvalidation.xyz',
    pass: 'Wesson1234$'
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html, text, from, fromName } = req.body;

  // Validate required fields
  if (!to) {
    return res.status(400).json({ error: 'Recipient email (to) is required' });
  }

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  if (!html && !text) {
    return res.status(400).json({ error: 'Either html or text content is required' });
  }

  try {
    // Create transporter with hard-coded SMTP config
    const transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      auth: SMTP_CONFIG.auth,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify SMTP connection
    await transporter.verify();

    // Always use the authenticated email as the sender (required by Hostinger)
    // Hostinger requires the "from" address to match the authenticated user
    const fromEmail = SMTP_CONFIG.auth.user; // Always use the authenticated email
    const fromNameValue = fromName || 'Email Verifier';
    // Use simple format: "Name <email>" or just email
    const fromAddress = fromNameValue ? `${fromNameValue} <${fromEmail}>` : fromEmail;

    // Convert recipients to array if needed
    const recipients = Array.isArray(to) ? to : [to];

    // Send email via SMTP
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients,
      subject: subject,
      html: html || undefined,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : undefined), // Convert HTML to text if only HTML provided
    });

    return res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      to: to,
      from: fromEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('SMTP error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email',
      details: error.response || error.code || 'Unknown error'
    });
  }
}
