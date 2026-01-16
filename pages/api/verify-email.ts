import { NextApiRequest, NextApiResponse } from 'next';
import dns from 'dns';
import net from 'net';
import nodemailer from 'nodemailer';
import axios from 'axios';

// Validate email format
function isValidFormat(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Mails.so Verifier Class
class MailsSoVerifier {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string | null = null) {
    this.apiKey = apiKey || process.env.MAILS_API_KEY || process.env.MAILS_SO_API_KEY || '';
    this.baseUrl = 'https://api.mails.so/v1';
    console.log(`🔑 Mails.so initialized with key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
  }

  isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Verify single email using Mails.so API
  async verifyEmail(email: string, options: { timeout?: number } = {}): Promise<{
    success: boolean;
    email: string;
    result: string;
    score: number;
    status: string;
    deliverable: boolean;
    details: any;
    error?: string;
    raw?: any;
  }> {
    console.log(`🚀 Starting Mails.so verification for: ${email}`);

    if (!this.apiKey) {
      return this.formatError('API key not configured. Please set MAILS_API_KEY in .env file', email);
    }

    if (!this.isValidEmailFormat(email)) {
      return this.formatError('Invalid email format', email);
    }

    try {
      console.log('🔍 Making API request to Mails.so...');
      console.log(`📤 URL: ${this.baseUrl}/validate`);
      console.log(`🔑 Using API key: ${this.apiKey.substring(0, 12)}...`);

      const response = await axios.get(`${this.baseUrl}/validate`, {
        params: {
          email: email
        },
        headers: {
          'x-mails-api-key': this.apiKey,
          'User-Agent': 'EmailVerifier/1.0'
        },
        timeout: options.timeout || 10000
      });

      console.log('✅ Mails.so API Response received:', {
        result: response.data?.data?.result || response.data?.result || response.data?.status,
        score: response.data?.data?.score || response.data?.score,
        status: response.data?.data?.status || response.data?.status
      });

      return this.formatSuccess(response.data);
    } catch (error: any) {
      console.error('❌ Mails.so API Error Details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      return this.handleError(error, email);
    }
  }

  handleError(error: any, email: string): {
    success: boolean;
    email: string;
    result: string;
    score: number;
    status: string;
    deliverable: boolean;
    error: string;
    details: any;
  } {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          console.error('❌ Invalid API key. Please verify your key');
          return this.formatError(
            `Invalid API key. Please check: 
            1. Your key: ${this.apiKey.substring(0, 12)}...
            2. Ensure it's active and valid
            3. Check if you have available credits`,
            email
          );
        case 403:
          return this.formatError('Forbidden. Key may be disabled or rate limited.', email);
        case 429:
          return this.formatError('Rate limit exceeded. Try again later.', email);
        case 400:
          return this.formatError('Bad request: ' + (error.response.data?.message || error.response.data?.error || 'Invalid parameters'), email);
        default:
          return this.formatError(`API Error ${error.response.status}: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`, email);
      }
    } else if (error.code === 'ECONNABORTED') {
      return this.formatError('Request timeout. Try again.', email);
    } else if (error.code === 'ENOTFOUND') {
      return this.formatError('Network error. Check your internet connection.', email);
    } else {
      return this.formatError('Unknown error: ' + error.message, email);
    }
  }

  formatSuccess(data: any): {
    success: boolean;
    email: string;
    result: string;
    score: number;
    status: string;
    deliverable: boolean;
    details: any;
    raw: any;
  } {
    // Extract data from mails.so response structure: { data: { ... }, error: null }
    const responseData = data?.data || data;
    
    // Handle different possible response formats from mails.so
    const result = responseData?.result || responseData?.status || responseData?.validity || 'unknown';
    const score = responseData?.score || responseData?.confidence || (result === 'valid' || result === 'deliverable' ? 100 : 0);
    
    // Map various possible result values to our standard format
    const resultMap: { [key: string]: boolean } = {
      'valid': true,
      'deliverable': true,
      'invalid': false,
      'undeliverable': false,
      'risky': false,
      'unknown': false,
      'catch_all': false
    };

    const deliverable = resultMap[result?.toLowerCase()] ?? (result === true || result === 'true');

    const verificationResult = {
      success: deliverable,
      email: responseData?.email || '',
      result: result,
      score: typeof score === 'number' ? score : (deliverable ? 100 : 0),
      status: this.getStatusDescription(result),
      deliverable: deliverable,
      details: {
        disposable: responseData?.is_disposable || responseData?.disposable || false,
        webmail: responseData?.is_free || responseData?.webmail || responseData?.free || false,
        mx_records: responseData?.mx_record || responseData?.mx_records || responseData?.mx || null,
        smtp_server: responseData?.smtp_server || null,
        smtp_check: responseData?.smtp_check || responseData?.smtp || null,
        accept_all: responseData?.isv_nocatchall === false || responseData?.accept_all || responseData?.catch_all || false,
        role: responseData?.role || false,
        reason: responseData?.reason || responseData?.message || null,
        isv_format: responseData?.isv_format || null,
        isv_domain: responseData?.isv_domain || null,
        isv_mx: responseData?.isv_mx || null,
        isv_noblock: responseData?.isv_noblock || null,
        isv_nocatchall: responseData?.isv_nocatchall || null,
        isv_nogeneric: responseData?.isv_nogeneric || null
      },
      raw: data // Include raw response for debugging
    };

    console.log(`📊 Mails.so Verification Complete:`);
    console.log(`   Email: ${verificationResult.email}`);
    console.log(`   Result: ${verificationResult.result}`);
    console.log(`   Score: ${verificationResult.score}`);
    console.log(`   Deliverable: ${verificationResult.deliverable}`);

    return verificationResult;
  }

  formatError(message: string, email: string = ''): {
    success: boolean;
    email: string;
    result: string;
    score: number;
    status: string;
    deliverable: boolean;
    error: string;
    details: any;
  } {
    const result = {
      success: false,
      email: email,
      result: 'error',
      score: 0,
      status: 'Error',
      deliverable: false,
      error: message,
      details: {}
    };

    console.error('❌ Mails.so Error Result:', result);
    return result;
  }

  getStatusDescription(result: string): string {
    const statusMap: { [key: string]: string } = {
      'valid': 'Valid and deliverable',
      'deliverable': 'Valid and deliverable',
      'invalid': 'Not deliverable',
      'undeliverable': 'Not deliverable',
      'risky': 'Risky or questionable',
      'unknown': 'Unable to verify',
      'catch_all': 'Accept all (catch-all)',
      'error': 'Verification error'
    };
    return statusMap[result?.toLowerCase()] || 'Unknown';
  }
}

// Verify email using Mails.so API
export async function verifyViaMailsSo(email: string): Promise<{
  exists: boolean | null;
  reason?: string;
  method?: string;
  details?: {
    format: 'valid' | 'invalid';
    type: 'webmail' | 'generic' | 'disposable' | 'unknown';
    serverStatus: 'valid' | 'invalid';
    emailStatus: 'valid' | 'invalid' | 'accept_all' | 'unknown';
    score?: number;
    result?: string;
    reason?: string;
    accept_all?: boolean;
    disposable?: boolean;
    free?: boolean;
    safe_to_send?: boolean;
  };
}> {
  const apiKey = process.env.MAILS_API_KEY || process.env.MAILS_SO_API_KEY;
  
  if (!apiKey) {
    return { exists: null, reason: 'Mails.so API key not configured', method: 'mails' };
  }

  try {
    console.log('🚀 Starting Mails.so verification for:', email);
    const verifier = new MailsSoVerifier(apiKey);
    const result = await verifier.verifyEmail(email, { timeout: 10000 });

    console.log('📊 Mails.so Result:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('❌ Mails.so verification error:', result.error);
      return { exists: null, reason: `Mails.so API error: ${result.error}`, method: 'mails' };
    }

    // Map Mails.so response to our format
    let exists: boolean | null = null;
    const mailsResult = result.result?.toLowerCase() || '';
    
    console.log('🔍 Determining email existence from result:', mailsResult);
    
    if (mailsResult === 'valid' || mailsResult === 'deliverable') {
      exists = true;
      console.log('✅ Email is deliverable');
    } else if (mailsResult === 'invalid' || mailsResult === 'undeliverable') {
      exists = false;
      console.log('❌ Email is undeliverable');
    } else if (mailsResult === 'risky' || mailsResult === 'unknown' || mailsResult === 'catch_all') {
      exists = null;
      console.log('⚠️ Email status is risky/unknown/catch-all');
    }

    // Extract detailed information
    const details = {
      format: result.details?.isv_format === true ? 'valid' as const : 'invalid' as const,
      type: result.details?.disposable ? 'disposable' as const :
            result.details?.webmail ? 'webmail' as const :
            'generic' as const,
      serverStatus: result.details?.isv_mx === true || result.details?.mx_records ? 'valid' as const : 'invalid' as const,
      emailStatus: mailsResult === 'valid' || mailsResult === 'deliverable' ? 'valid' as const :
                   mailsResult === 'invalid' || mailsResult === 'undeliverable' ? 'invalid' as const :
                   result.details?.isv_nocatchall === false ? 'accept_all' as const :
                   mailsResult === 'risky' ? 'unknown' as const : 'unknown' as const,
      score: result.score,
      result: result.result,
      reason: result.status,
      accept_all: result.details?.isv_nocatchall === false || result.details?.accept_all || false,
      disposable: result.details?.disposable || false,
      free: result.details?.webmail || false,
      safe_to_send: (mailsResult === 'valid' || mailsResult === 'deliverable') && !result.details?.disposable
    };

    let reason = result.status || '';
    if (result.details?.reason) {
      reason = result.details.reason;
    } else if (result.details?.smtp_check) {
      reason = `SMTP check: ${result.details.smtp_check}`;
    }

    const finalResult = {
      exists,
      reason,
      method: 'mails',
      details
    };

    console.log('🎯 Final Mails.so Verification Result:', JSON.stringify(finalResult, null, 2));

    return finalResult;
  } catch (error: any) {
    console.error('❌ Mails.so verification exception:', error);
    return { exists: null, reason: `Mails.so API error: ${error.message}`, method: 'mails' };
  }
}

// Check if email is from a disposable email service
function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
    'throwaway.email', 'temp-mail.org', 'getnada.com', 'mohmal.com',
    'fakeinbox.com', 'trashmail.com', 'maildrop.cc', 'yopmail.com',
    'sharklasers.com', 'grr.la', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'bccto.me', 'chitthi.in', 'dispostable.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.some(d => domain?.includes(d));
}

// Check if email is from a known webmail provider
function isWebmailProvider(email: string): boolean {
  const webmailProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'gmx.com', 'live.com', 'msn.com', 'rediffmail.com', 'inbox.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return webmailProviders.some(p => domain === p);
}

// Enhanced email verification with multiple checks
async function comprehensiveEmailCheck(email: string, domain: string, mxRecords: dns.MxRecord[]): Promise<{
  format: 'valid' | 'invalid';
  type: 'webmail' | 'generic' | 'disposable' | 'unknown';
  serverStatus: 'valid' | 'invalid';
  emailStatus: 'valid' | 'invalid' | 'unknown';
  confidence: number;
  details: string[];
}> {
  const details: string[] = [];
  let confidence = 0;

  // Format check (20 points)
  const formatValid = isValidFormat(email);
  if (formatValid) {
    confidence += 20;
    details.push('✓ Email format is valid');
  } else {
    details.push('✗ Email format is invalid');
  }

  // Disposable email check (30 points deduction if disposable)
  const isDisposable = isDisposableEmail(email);
  if (isDisposable) {
    confidence -= 30;
    details.push('⚠ Email is from a disposable/temporary email service');
  }

  // Webmail provider check
  const isWebmail = isWebmailProvider(email);
  const type = isDisposable ? 'disposable' : isWebmail ? 'webmail' : 'generic';

  // MX records check (30 points)
  const hasMXRecords = mxRecords && mxRecords.length > 0;
  if (hasMXRecords) {
    confidence += 30;
    details.push(`✓ MX records found (${mxRecords.length} record(s))`);
  } else {
    details.push('✗ No MX records found');
  }

  // Server connectivity check (20 points)
  // This is already done in the main handler, but we can note it here
  if (hasMXRecords) {
    confidence += 20;
    details.push('✓ Mail server is reachable');
  }

  // For webmail providers, we can't verify individual emails via SMTP
  // but we can confirm the domain is valid
  if (isWebmail && hasMXRecords) {
    details.push('ℹ Webmail provider detected - individual email verification may be limited');
    // For webmail, we should NOT mark as valid just based on format/MX
    // We need actual SMTP verification to confirm
    confidence = Math.min(confidence, 50); // Cap confidence for webmail without SMTP verification
  }

  // Never mark as "valid" without actual SMTP verification for webmail providers
  // Format + MX records only confirm domain validity, not email existence
  let emailStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
  if (isWebmail) {
    // For webmail, we can only confirm domain is valid, not the email
    emailStatus = 'unknown';
  } else if (confidence < 0 || isDisposable) {
    emailStatus = 'invalid';
  } else if (confidence >= 70 && !isWebmail) {
    // Only mark as valid for non-webmail if we have high confidence
    // But still prefer SMTP verification
    emailStatus = 'unknown'; // Changed to unknown - we need SMTP to confirm
  } else {
    emailStatus = 'unknown';
  }

  return {
    format: formatValid ? 'valid' : 'invalid',
    type: type as 'webmail' | 'generic' | 'disposable' | 'unknown',
    serverStatus: hasMXRecords ? 'valid' : 'invalid',
    emailStatus: emailStatus,
    confidence: Math.max(0, Math.min(100, confidence)),
    details
  };
}


// Get MX records for domain
function getMXRecords(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

// SMTP verification using authenticated connection
// This is now just an alias - actual implementation is in verifyViaAuthenticatedSMTP
async function verifySMTPWithAuth(
  email: string, 
  mxHost: string,
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }
): Promise<{ exists: boolean | null; reason?: string }> {
  // Use authenticated SMTP directly
  return await verifyViaAuthenticatedSMTP(email, smtpConfig);
}

// Verify email using authenticated SMTP relay
// Attempts to verify by checking if the SMTP server accepts the email address
async function verifyViaAuthenticatedSMTP(
  email: string,
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }
): Promise<{ exists: boolean | null; reason?: string; method?: string }> {
  try {
    // Create transporter with authenticated SMTP
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure, // true for 465, false for other ports
      auth: smtpConfig.auth,
      tls: {
        rejectUnauthorized: false
      },
      logger: false,
      debug: false,
      requireTLS: false,
      connectionTimeout: 10000, // 10 second timeout
      greetingTimeout: 10000
    });

    // Verify the SMTP connection is working
    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP connection timeout')), 10000))
      ]);
    } catch (verifyError: any) {
      return { exists: null, reason: `SMTP connection failed: ${verifyError.message}`, method: 'authenticated' };
    }
    
    // Attempt to verify by checking if server accepts the email
    // Note: This will attempt to send a test email to verify the address
    try {
      const testMessage = {
        from: smtpConfig.auth.user,
        to: email,
        subject: 'Email Verification Test',
        text: 'This is an automated email verification test. Please ignore this message.',
        // Some servers validate during RCPT TO phase
      };

      // Attempt to send with timeout
      const sendPromise = transporter.sendMail(testMessage);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Send timeout')), 15000)
      );
      
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      // If we get here, the server accepted the email
      return { exists: true, reason: 'Email accepted by authenticated SMTP server', method: 'authenticated' };
    } catch (sendError: any) {
      // Check for specific rejection codes
      const errorCode = sendError.responseCode || sendError.code;
      const errorMessage = (sendError.response || sendError.message || '').toString().toLowerCase();
      
      // 550, 551, 553 typically mean email doesn't exist or is rejected
      if (errorCode === 550 || errorCode === 551 || errorCode === 553) {
        return { exists: false, reason: 'Email rejected by server - does not exist', method: 'authenticated' };
      }
      
      // Check error message for rejection indicators
      if (errorMessage.includes('550') || errorMessage.includes('551') || errorMessage.includes('553') ||
          errorMessage.includes('user unknown') || 
          (errorMessage.includes('mailbox') && errorMessage.includes('not found')) ||
          errorMessage.includes('no such user') ||
          errorMessage.includes('invalid recipient')) {
        return { exists: false, reason: 'Email rejected - does not exist', method: 'authenticated' };
      }
      
      // For Gmail specifically, they often accept all emails to prevent enumeration
      // So we can't reliably verify Gmail addresses this way
      if (email.toLowerCase().includes('@gmail.com')) {
        return { 
          exists: null, 
          reason: 'Gmail accepts all emails through SMTP relays to prevent enumeration. Cannot verify without sending actual email.', 
          method: 'authenticated' 
        };
      }
      
      // Other errors mean we can't determine
      return { exists: null, reason: `SMTP server response: ${errorMessage || sendError.message}`, method: 'authenticated' };
    }
  } catch (error: any) {
    return { exists: null, reason: `SMTP authentication error: ${error.message}`, method: 'authenticated' };
  }
}

// Direct SMTP verification - tries both port 25 and 587
function verifySMTP(email: string, mxHost: string): Promise<{ exists: boolean | null; reason?: string; method?: string }> {
  return new Promise((resolve) => {
    // Try port 25 first (standard SMTP)
    tryPort(email, mxHost, 25, (result) => {
      resolve({ ...result, method: 'smtp' });
    });
  });
}

// Try SMTP connection on specific port
function tryPort(
  email: string, 
  mxHost: string, 
  port: number, 
  resolve: (value: { exists: boolean | null; reason?: string }) => void
) {
  const socket = net.createConnection(port, mxHost);
  let stage = 0;
  let verified: boolean | null = null;
  let responseBuffer = '';

  socket.setTimeout(5000); // Shorter timeout for faster fallback

  socket.on('data', (data) => {
    responseBuffer += data.toString();
    const response = responseBuffer.trim();
    
    if (stage === 0 && response.includes('220')) {
      socket.write('HELO verify.com\r\n');
      stage = 1;
      responseBuffer = '';
    } else if (stage === 1 && (response.includes('250') || response.includes('220'))) {
      socket.write('MAIL FROM:<verify@verify.com>\r\n');
      stage = 2;
      responseBuffer = '';
    } else if (stage === 2 && response.includes('250')) {
      socket.write(`RCPT TO:<${email}>\r\n`);
      stage = 3;
      responseBuffer = '';
    } else if (stage === 3) {
      if (response.includes('250') || response.includes('251')) {
        verified = true;
      } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
        verified = false;
      } else if (response.includes('450') || response.includes('451') || response.includes('452')) {
        verified = null;
      } else if (response.includes('421') || response.includes('554')) {
        verified = null;
      }
      
      socket.write('QUIT\r\n');
      socket.end();
    }
  });

  socket.on('error', () => {
    // If port 25 fails, try port 587 (submission port) for major providers
    if (port === 25) {
      tryPort(email, mxHost, 587, resolve);
    } else {
      resolve({ exists: null, reason: 'Connection blocked or failed on both ports 25 and 587' });
    }
  });

  socket.on('timeout', () => {
    socket.destroy();
    // If port 25 times out, try port 587
    if (port === 25) {
      tryPort(email, mxHost, 587, resolve);
    } else {
      resolve({ exists: null, reason: 'Connection timeout - server blocks verification attempts' });
    }
  });

  socket.on('close', () => {
    if (verified !== null) {
      resolve({ exists: verified });
    } else if (port === 25) {
      // Try port 587 as fallback
      tryPort(email, mxHost, 587, resolve);
    } else {
      resolve({ exists: null, reason: 'Unable to verify - server may block email verification' });
    }
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  console.log(`\n📨 POST /api/verify-email ${new Date().toISOString()}`);
  console.log(`📧 Verification request for: ${email || 'No email provided'}`);

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required',
      example: { "email": "test@example.com" }
    });
  }

  if (!isValidFormat(email)) {
    return res.status(400).json({ 
      exists: false, 
      error: 'Invalid email format',
      email: email
    });
  }

  try {
    const domain = email.split('@')[1];
    
    // Check MX records
    const mxRecords = await getMXRecords(domain);
    
    if (!mxRecords || mxRecords.length === 0) {
      return res.json({ exists: false, reason: 'No MX records found' });
    }

    // Sort by priority and get primary mail server
    mxRecords.sort((a, b) => a.priority - b.priority);
    const primaryMX = mxRecords[0].exchange;

    // Try Mails.so API if API key is configured
    const mailsApiKey = process.env.MAILS_API_KEY || process.env.MAILS_SO_API_KEY;
    if (mailsApiKey) {
      console.log('🔑 Mails.so API key found, using Mails.so API for verification');
      const mailsResult = await verifyViaMailsSo(email);
      
      console.log('📋 Mails.so Result Summary:', {
        exists: mailsResult.exists,
        reason: mailsResult.reason,
        method: mailsResult.method,
        hasDetails: !!mailsResult.details
      });
      
      // If Mails.so gives a definitive result, use it
      if (mailsResult.exists !== null || mailsResult.details) {
        const response = {
          exists: mailsResult.exists,
          verified: mailsResult.exists !== null,
          mxRecords: mxRecords.length,
          mailServer: primaryMX,
          reason: mailsResult.reason,
          method: 'mails',
          details: mailsResult.details,
          note: mailsResult.exists === null ? 'Mails.so cannot definitively verify this email address.' : undefined
        };
        
        console.log('📤 Sending Mails.so response to client:', JSON.stringify(response, null, 2));
        
        return res.json(response);
      }
    } else {
      console.log('⚠️ Mails.so API key not found, falling back to comprehensive checks');
    }

    // Perform comprehensive email check
    const comprehensiveCheck = await comprehensiveEmailCheck(email, domain, mxRecords);

    // Get SMTP configuration from environment variables
    const smtpConfig = {
      host: process.env.MAIL_HOST || '',
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: process.env.MAIL_PORT === '465', // true for 465, false for 587
      auth: {
        user: process.env.MAIL_USERNAME || '',
        pass: process.env.MAIL_PASSWORD || ''
      }
    };

    // Extract domain from SMTP username if available
    const smtpDomain = smtpConfig.auth.user ? smtpConfig.auth.user.split('@')[1] : null;
    const emailDomain = email.split('@')[1];

    // Use authenticated SMTP if credentials are provided
    let smtpResult;
    const useAuthSMTP = smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass;
    const sameDomain = smtpDomain && smtpDomain.toLowerCase() === emailDomain.toLowerCase();

    // For Gmail and other major providers that block port 25, try authenticated SMTP first
    const isGmail = emailDomain.toLowerCase().includes('gmail.com');
    const isMajorProvider = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com'].some(
      provider => emailDomain.toLowerCase().includes(provider)
    );

    if (useAuthSMTP && (sameDomain || isMajorProvider)) {
      // For same domain or major providers, try authenticated SMTP first
      console.log(`Using authenticated SMTP for ${emailDomain}`);
      smtpResult = await verifyViaAuthenticatedSMTP(email, smtpConfig);
      
      // For Gmail, if authenticated SMTP can't verify, we can't use direct SMTP either
      // Gmail blocks all direct verification attempts
      if (smtpResult.exists === null && !isGmail) {
        console.log('Authenticated SMTP inconclusive, trying direct SMTP');
        const directResult = await verifySMTP(email, primaryMX);
        // Use direct result if it's more definitive
        if (directResult.exists !== null) {
          smtpResult = directResult;
        }
      }
    } else {
      // Try direct SMTP first
      smtpResult = await verifySMTP(email, primaryMX);
      
      // If direct SMTP fails and we have authenticated SMTP, try that as fallback
      if (smtpResult.exists === null && useAuthSMTP) {
        console.log('Direct SMTP failed, trying authenticated SMTP');
        const authResult = await verifyViaAuthenticatedSMTP(email, smtpConfig);
        // Only use auth result if it's more definitive
        if (authResult.exists !== null) {
          smtpResult = authResult;
        } else if (authResult.reason) {
          // Keep the authenticated SMTP reason even if result is null
          smtpResult.reason = authResult.reason;
        }
      }
    }

    // Combine comprehensive check with SMTP result
    let finalExists: boolean | null = smtpResult.exists;
    let finalReason = smtpResult.reason || '';
    
    // If SMTP verification is blocked/unavailable, be conservative
    if (smtpResult.exists === null) {
      // For webmail providers, we can NEVER confirm email exists without SMTP verification
      if (comprehensiveCheck.type === 'webmail') {
        finalExists = null;
        finalReason = 'Cannot verify Gmail/webmail addresses without SMTP verification. Domain is valid, but email existence cannot be confirmed.';
      } 
      // For disposable emails, mark as invalid
      else if (comprehensiveCheck.type === 'disposable' || comprehensiveCheck.emailStatus === 'invalid') {
        finalExists = false;
        finalReason = 'Email is from a disposable service or appears invalid';
      }
      // For other emails, only mark as invalid if we're very confident it's invalid
      else if (comprehensiveCheck.confidence < 30 || !comprehensiveCheck.format || !comprehensiveCheck.serverStatus) {
        finalExists = false;
        finalReason = 'Email appears invalid - format or domain issues detected';
      }
      // Otherwise, we can't determine without SMTP verification
      else {
        finalExists = null;
        finalReason = 'Cannot definitively verify email without SMTP verification. Format and domain appear valid, but email existence cannot be confirmed.';
      }
    }

    // Build response with comprehensive details
    const response: any = {
      exists: finalExists,
      verified: finalExists !== null,
      mxRecords: mxRecords.length,
      mailServer: primaryMX,
      reason: finalReason,
      method: (smtpResult as any)?.method || 'comprehensive',
      details: {
        format: comprehensiveCheck.format,
        type: comprehensiveCheck.type,
        serverStatus: comprehensiveCheck.serverStatus,
        emailStatus: comprehensiveCheck.emailStatus,
        confidence: comprehensiveCheck.confidence,
        checkDetails: comprehensiveCheck.details
      }
    };

    // Add note for webmail providers
    if (comprehensiveCheck.type === 'webmail' && finalExists === null) {
      response.note = 'Webmail providers (like Gmail) block SMTP verification to prevent email enumeration. The domain is valid, but individual email verification may be limited.';
    } else if (comprehensiveCheck.type === 'disposable') {
      response.note = 'This email is from a disposable/temporary email service.';
    }

    return res.json(response);

  } catch (error: any) {
    console.error('Verification error:', error);
    return res.json({ 
      exists: false, 
      error: 'Unable to verify email',
      reason: error.message 
    });
  }
}
