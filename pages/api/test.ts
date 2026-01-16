import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Hard-coded Mails.so API Key
const MAILS_API_KEY = '35fae0f0-cc0a-4859-a885-b36abbace7b7';

// Create a batch job and wait for results
async function batchVerifyEmails(emails: string[]): Promise<any[]> {
  try {
    // Step 1: Create batch job
    const createResponse = await axios.post('https://api.mails.so/v1/batch', 
      { emails: emails },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-mails-api-key': MAILS_API_KEY
        }
      }
    );

    const batchId = createResponse.data?.id;
    if (!batchId) {
      throw new Error('No batch ID returned from API');
    }

    console.log(`Batch job created with ID: ${batchId}`);

    // Step 2: Poll for results (with timeout)
    const maxAttempts = 30; // Maximum 30 attempts
    const pollInterval = 1000; // 1 second between polls
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        const statusResponse = await axios.get(`https://api.mails.so/v1/batch/${batchId}`, {
          headers: {
            'x-mails-api-key': MAILS_API_KEY
          }
        });

        const batchData = statusResponse.data;
        
        // Check if batch is finished
        if (batchData.finished_at) {
          // Process results
          const emailResults = batchData.emails || [];
          
          return emails.map((email) => {
            const result = emailResults.find((r: any) => r.email === email);
            
            if (!result) {
              return {
                success: false,
                email: email,
                result: 'unknown',
                deliverable: false,
                error: 'No result found for email'
              };
            }

            const status = result.result || 'unknown';
            const score = result.score || 0;
            
            // Handle result types according to mails.so documentation:
            // "deliverable" - valid and can receive messages
            // "undeliverable" - invalid or cannot receive messages
            // "risky" - might be valid but has risk factors
            // "unknown" - couldn't determine status
            const isDeliverable = status === 'deliverable';
            const isUndeliverable = status === 'undeliverable';
            const isRisky = status === 'risky';
            const isUnknown = status === 'unknown';
            
            return {
              success: isDeliverable, // Only "deliverable" is considered successful
              email: result.email || email,
              result: status,
              score: typeof score === 'number' ? score : 0,
              deliverable: isDeliverable,
              risky: isRisky,
              unknown: isUnknown,
              details: {
                disposable: false, // Not provided in batch API
                webmail: result.is_free || false,
                format: result.isv_format || false,
                domain: result.isv_domain || false,
                mx: result.isv_mx || false
              },
              reason: result.reason
            };
          });
        }

        attempts++;
      } catch (pollError: any) {
        if (pollError.response?.status === 404) {
          throw new Error('Batch job not found');
        }
        // Continue polling on other errors
        attempts++;
      }
    }

    // Timeout - return unknown results
    throw new Error('Batch validation timeout - results not available');
  } catch (error: any) {
    console.error('Batch API error:', error);
    
    // Return failed results for all emails
    return emails.map(email => ({
      success: false,
      email: email,
      result: 'error',
      deliverable: false,
      error: error.response?.data?.error || error.message || 'Batch verification failed'
    }));
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get username from query parameter
  const username = req.query.username as string;
  
  if (!username) {
    return res.status(400).json({
      error: 'Username is required',
      usage: 'Add ?username=yourusername to the URL (e.g., /api/test?username=samueldickson06)'
    });
  }

  // Email domains to test
  const emailDomains = [
    'gmail.com',
    'yahoo.com',
    'proton.me',
    'outlook.com',
    'hotmail.com',
  ];

  console.log(`🧪 Testing username "${username}" across ${emailDomains.length} email domains`);

  try {
    // Generate all emails for this username (always generate, even if validation fails)
    const allEmails = emailDomains.map(domain => `${username}@${domain}`);
    
    // Check if API key is configured
    const hasValidApiKey = MAILS_API_KEY && MAILS_API_KEY !== '<your-api-key>';
    
    let batchResults: any[] = [];
    
    if (hasValidApiKey) {
      console.log(`  Batch checking: ${allEmails.join(', ')}`);
      // Use batch API to verify all emails at once
      batchResults = await batchVerifyEmails(allEmails);
    } else {
      console.log(`  API key not configured - generating emails without validation`);
      // Generate results without validation
      batchResults = allEmails.map(email => ({
        success: false,
        email: email,
        result: 'unknown',
        deliverable: false,
        error: 'API key not configured'
      }));
    }

    // Format results with domain information
    const results = batchResults.map((result, index) => ({
      email: result.email || allEmails[index],
      domain: emailDomains[index],
      ...result
    }));

    // Find available emails - only "deliverable" status is considered available
    // "risky" and "unknown" are not considered available
    const availableEmails = results.filter(r => r.deliverable === true);
    const unavailableEmails = results.filter(r => r.result === 'undeliverable');
    const riskyEmails = results.filter(r => r.risky === true);
    const unknownEmails = results.filter(r => r.unknown === true);

    // Always include all generated emails
    const allGeneratedEmails = emailDomains.map(domain => `${username}@${domain}`);
    
    res.json({
      username: username,
      test: 'Multi-Domain Email Availability Check',
      totalDomains: emailDomains.length,
      available: availableEmails.length,
      unavailable: unavailableEmails.length,
      results: results,
      summary: {
        available: availableEmails.map(r => r.email),
        unavailable: unavailableEmails.map(r => r.email)
      },
      allGenerated: allGeneratedEmails, // Always include all generated emails
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    // Even if validation fails, return all generated emails
    const emailDomains = [
      'gmail.com',
      'yahoo.com',
      'proton.me',
      'outlook.com',
      'hotmail.com',
    ];
    
    const allGeneratedEmails = emailDomains.map(domain => `${username}@${domain}`);
    
    res.status(500).json({
      username: username,
      test: 'Validation Failed - But emails generated',
      error: error.message,
      totalDomains: emailDomains.length,
      available: 0,
      unavailable: 0,
      results: allGeneratedEmails.map(email => ({
        email: email,
        domain: email.split('@')[1],
        success: false,
        deliverable: false,
        error: 'Validation failed'
      })),
      summary: {
        available: [],
        unavailable: allGeneratedEmails
      },
      allGenerated: allGeneratedEmails, // Always include all generated emails
      suggestion: 'Check your API key and internet connection',
      timestamp: new Date().toISOString()
    });
  }
}

