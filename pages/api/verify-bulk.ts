import { NextApiRequest, NextApiResponse } from 'next';
import { verifyViaMailsSo } from './verify-email';

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

interface EmailResult {
  email: string;
  exists: boolean | null;
  reason?: string;
  score?: number;
  details?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { usernames } = req.body;

  console.log(`\n📨 POST /api/verify-bulk ${new Date().toISOString()}`);
  console.log(`📧 Bulk verification request for ${usernames?.length || 0} usernames`);

  if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Usernames array is required',
      example: { "usernames": ["john", "jane", "doe"] }
    });
  }

  // Validate usernames (basic validation)
  const validUsernames = usernames
    .map((u: string) => String(u).trim().toLowerCase())
    .filter((u: string) => u.length > 0 && /^[a-z0-9._-]+$/i.test(u));

  if (validUsernames.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid usernames provided'
    });
  }

  // Generate all email combinations
  const emailsToVerify: string[] = [];
  validUsernames.forEach(username => {
    DOMAINS.forEach(domain => {
      emailsToVerify.push(`${username}@${domain}`);
    });
  });

  console.log(`📋 Generated ${emailsToVerify.length} emails to verify (${validUsernames.length} usernames × ${DOMAINS.length} domains)`);

  // Verify all emails
  const results: EmailResult[] = [];
  const deliverable: EmailResult[] = [];
  const nonDeliverable: EmailResult[] = [];
  const unknown: EmailResult[] = [];

  let processed = 0;
  const total = emailsToVerify.length;

  // Process emails with a small delay to avoid rate limiting
  for (const email of emailsToVerify) {
    try {
      processed++;
      console.log(`[${processed}/${total}] Verifying: ${email}`);
      
      const result = await verifyViaMailsSo(email);
      
      const emailResult: EmailResult = {
        email,
        exists: result.exists,
        reason: result.reason,
        score: result.details?.score,
        details: result.details
      };

      results.push(emailResult);

      // Categorize results
      if (result.exists === true) {
        deliverable.push(emailResult);
      } else if (result.exists === false) {
        nonDeliverable.push(emailResult);
      } else {
        unknown.push(emailResult);
      }

      // Small delay to avoid rate limiting (100ms between requests)
      if (processed < total) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`❌ Error verifying ${email}:`, error.message);
      const errorResult: EmailResult = {
        email,
        exists: null,
        reason: `Error: ${error.message}`
      };
      results.push(errorResult);
      unknown.push(errorResult);
    }
  }

  console.log(`✅ Bulk verification complete:`);
  console.log(`   Deliverable: ${deliverable.length}`);
  console.log(`   Non-deliverable: ${nonDeliverable.length}`);
  console.log(`   Unknown: ${unknown.length}`);

  return res.json({
    success: true,
    summary: {
      total: results.length,
      deliverable: deliverable.length,
      nonDeliverable: nonDeliverable.length,
      unknown: unknown.length
    },
    deliverable: deliverable,
    nonDeliverable: nonDeliverable,
    unknown: unknown,
    all: results,
    timestamp: new Date().toISOString()
  });
}

