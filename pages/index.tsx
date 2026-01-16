'use client';

import { useState } from 'react';

export default function EmailVerifier() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'username'>('username');
  
  // Single email verification
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Bulk verification
  const [usernames, setUsernames] = useState('');
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  // Username check
  const [username, setUsername] = useState('');
  const [usernameResult, setUsernameResult] = useState<any>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameProgress, setUsernameProgress] = useState({ current: 0, total: 0 });
  
  // Send email
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendContent, setSendContent] = useState('');
  const [sendFrom, setSendFrom] = useState('');
  const [sendFromName, setSendFromName] = useState('');
  const [sendResult, setSendResult] = useState<any>(null);
  const [sendLoading, setSendLoading] = useState(false);

  const verifyEmail = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ exists: false, error: 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  const verifyBulk = async () => {
    setBulkLoading(true);
    setBulkResult(null);
    setProgress({ current: 0, total: 0 });
    
    try {
      // Parse usernames from textarea (split by newline, comma, or space)
      const usernameList = usernames
        .split(/[\n,\s]+/)
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (usernameList.length === 0) {
        alert('Please enter at least one username');
        setBulkLoading(false);
        return;
      }

      const totalEmails = usernameList.length * 4; // 4 domains per username (gmail, yahoo, outlook, hotmail)
      setProgress({ current: 0, total: totalEmails });

      const res = await fetch('/api/verify-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: usernameList })
      });
      
      const data = await res.json();
      setBulkResult(data);
      setProgress({ current: totalEmails, total: totalEmails });
    } catch (error) {
      setBulkResult({ success: false, error: 'Request failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  const checkUsername = async () => {
    // Parse usernames from input (split by newline, comma, or space)
    const usernameList = username
      .split(/[\n,\s]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (usernameList.length === 0) {
      alert('Please enter at least one username');
      return;
    }

    setUsernameLoading(true);
    setUsernameResult(null);
    setUsernameProgress({ current: 0, total: usernameList.length });
    
    try {
      const allResults: any[] = [];
      
      // Check each username
      for (let i = 0; i < usernameList.length; i++) {
        const currentUsername = usernameList[i];
        setUsernameProgress({ current: i + 1, total: usernameList.length });
        
        try {
          const res = await fetch(`/api/test?username=${encodeURIComponent(currentUsername)}`);
          const data = await res.json();
          allResults.push({
            username: currentUsername,
            ...data
          });
        } catch (error: any) {
          // Even if request fails, generate all emails for this username
          const emailDomains = ['gmail.com', 'yahoo.com', 'proton.me', 'outlook.com', 'hotmail.com'];
          const allGeneratedEmails = emailDomains.map(domain => `${currentUsername}@${domain}`);
          
          allResults.push({
            username: currentUsername,
            error: error.message || 'Request failed',
            totalDomains: emailDomains.length,
            available: 0,
            unavailable: allGeneratedEmails.length,
            results: allGeneratedEmails.map(email => ({
              email: email,
              domain: email.split('@')[1],
              success: false,
              deliverable: false,
              error: 'Request failed'
            })),
            summary: {
              available: [],
              unavailable: allGeneratedEmails
            },
            allGenerated: allGeneratedEmails
          });
        }
      }

      // Aggregate results - collect ALL generated emails and validated ones separately
      const allAvailable: string[] = [];
      const allUnavailable: string[] = [];
      const allGeneratedEmails: string[] = []; // All emails generated (regardless of validation)
      let totalAvailable = 0;
      let totalUnavailable = 0;

      allResults.forEach(result => {
        // Collect all generated emails - use allGenerated if available, otherwise extract from results
        if (result.allGenerated && Array.isArray(result.allGenerated)) {
          result.allGenerated.forEach((email: string) => {
            if (!allGeneratedEmails.includes(email)) {
              allGeneratedEmails.push(email);
            }
          });
        } else if (result.results && Array.isArray(result.results)) {
          result.results.forEach((emailResult: any) => {
            if (emailResult.email && !allGeneratedEmails.includes(emailResult.email)) {
              allGeneratedEmails.push(emailResult.email);
            }
          });
        }
        
        // Collect validated emails
        if (result.summary?.available) {
          allAvailable.push(...result.summary.available);
          totalAvailable += result.summary.available.length;
        }
        if (result.summary?.unavailable) {
          allUnavailable.push(...result.summary.unavailable);
          totalUnavailable += result.summary.unavailable.length;
        }
      });

      const finalResult = {
        usernames: usernameList,
        results: allResults,
        summary: {
          totalUsernames: usernameList.length,
          totalAvailable,
          totalUnavailable,
          available: allAvailable,
          unavailable: allUnavailable,
          allGenerated: allGeneratedEmails // All emails generated (even if validation failed)
        }
      };
      
      setUsernameResult(finalResult);
      
      // Auto-populate send email recipients with ALL generated emails (not just validated)
      if (allGeneratedEmails.length > 0) {
        setSendTo(allGeneratedEmails.join(', '));
      }
    } catch (error: any) {
      setUsernameResult({ error: error.message || 'Request failed' });
    } finally {
      setUsernameLoading(false);
      setUsernameProgress({ current: 0, total: 0 });
    }
  };

  const sendEmail = async () => {
    // Use available emails from username check if sendTo is empty
    const recipientsToUse = sendTo.trim() || (usernameResult?.summary?.available?.join(', ') || '');
    
    if (!recipientsToUse) {
      alert('Please enter recipient email address(es) or check usernames first');
      return;
    }

    if (!sendSubject.trim()) {
      alert('Please enter email subject');
      return;
    }

    if (!sendContent.trim()) {
      alert('Please enter email content');
      return;
    }

    setSendLoading(true);
    setSendResult(null);

    try {
      // Parse recipients (split by comma, space, or newline)
      const recipients = recipientsToUse
        .split(/[\n,\s]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0 && r.includes('@'));

      if (recipients.length === 0) {
        alert('Please enter at least one valid email address');
        setSendLoading(false);
        return;
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients.length === 1 ? recipients[0] : recipients,
          subject: sendSubject,
          html: sendContent,
          from: sendFrom || undefined,
          fromName: sendFromName || undefined
        })
      });

      const data = await res.json();
      setSendResult(data);
    } catch (error: any) {
      setSendResult({ success: false, error: error.message || 'Request failed' });
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Email Verifier</h1>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('username')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'username'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Username Check
        </button>
        <button
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'single'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Single Email
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'bulk'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Bulk Verification
        </button>
      </div>

      {/* Username Check */}
      {activeTab === 'username' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enter Username(s) (separate by space, comma, or new line)
            </label>
            <textarea
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="samueldickson06&#10;johndoe&#10;janedoe"
              rows={6}
              className="border px-4 py-2 rounded w-full font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Each username will be checked across Gmail, Yahoo, Proton, Outlook, and Hotmail.
            </p>
          </div>
          
          <button
            onClick={checkUsername}
            disabled={usernameLoading || !username.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
          >
            {usernameLoading ? `Checking... (${usernameProgress.current}/${usernameProgress.total})` : 'Check Username(s)'}
          </button>

          {usernameLoading && usernameProgress.total > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${(usernameProgress.current / usernameProgress.total) * 100}%` }}
              ></div>
            </div>
          )}

          {usernameResult && (
            <div className="space-y-4">
              {/* Overall Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">Overall Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Usernames Checked:</span>
                    <span className="font-bold ml-2">{usernameResult.summary?.totalUsernames || usernameResult.usernames?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Available:</span>
                    <span className="font-bold ml-2">{usernameResult.summary?.totalAvailable || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Available Emails:</span>
                    <span className="font-bold ml-2 text-green-700">{usernameResult.summary?.available?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-red-600">Unavailable Emails:</span>
                    <span className="font-bold ml-2 text-red-700">{usernameResult.summary?.unavailable?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Results by Username */}
              {usernameResult.results && usernameResult.results.length > 0 && (
                <div className="space-y-4">
                  {usernameResult.results.map((userResult: any, userIdx: number) => (
                    <div key={userIdx} className="bg-white border rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-3">Username: "{userResult.username}"</h3>
                      
                      {/* Per-username Summary */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Total Checked:</span>
                            <span className="font-bold ml-2">{userResult.totalDomains || 0}</span>
                          </div>
                          <div>
                            <span className="text-green-600">Available:</span>
                            <span className="font-bold ml-2 text-green-700">{userResult.available || 0}</span>
                          </div>
                          <div>
                            <span className="text-red-600">Unavailable:</span>
                            <span className="font-bold ml-2 text-red-700">{userResult.unavailable || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Available Emails for this username */}
                      {userResult.summary?.available && userResult.summary.available.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                          <h4 className="font-bold text-sm mb-2 text-green-800">
                            ✓ Available ({userResult.summary.available.length})
                          </h4>
                          <div className="space-y-1">
                            {userResult.summary.available.map((email: string, idx: number) => {
                              const result = userResult.results?.find((r: any) => r.email === email);
                              return (
                                <div key={idx} className="bg-white p-2 rounded border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-medium">{email}</span>
                                    {result?.score && (
                                      <span className="text-xs text-gray-500">Score: {result.score}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Unavailable Emails for this username */}
                      {userResult.summary?.unavailable && userResult.summary.unavailable.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <h4 className="font-bold text-sm mb-2 text-red-800">
                            ✗ Unavailable ({userResult.summary.unavailable.length})
                          </h4>
                          <div className="space-y-1">
                            {userResult.summary.unavailable.map((email: string, idx: number) => (
                              <div key={idx} className="bg-white p-2 rounded border border-red-200">
                                <span className="font-mono text-xs">{email}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error for this username */}
                      {userResult.error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-800 text-sm">Error: {userResult.error}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Two Column Layout: Validated Emails on Left, All Emails on Right */}
              {usernameResult.summary && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Validated Emails - Left Side */}
                  {usernameResult.summary.available && usernameResult.summary.available.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-3 text-green-800">
                        ✓ Validated Emails ({usernameResult.summary.available.length})
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {usernameResult.summary.available.map((email: string, idx: number) => (
                          <div key={idx} className="bg-white p-2 rounded border border-green-200">
                            <span className="font-mono text-sm">{email}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(usernameResult.summary.available.join('\n'));
                            alert('Validated emails copied to clipboard!');
                          }}
                          className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Copy Validated Emails
                        </button>
                      </div>
                    </div>
                  )}

                  {/* All Generated Emails - Right Side */}
                  {usernameResult.summary.allGenerated && usernameResult.summary.allGenerated.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-3 text-blue-800">
                        📧 All Generated Emails ({usernameResult.summary.allGenerated.length})
                      </h3>
                      <p className="text-xs text-blue-600 mb-2">
                        All emails will be sent to these addresses (including unvalidated)
                      </p>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {usernameResult.summary.allGenerated.map((email: string, idx: number) => {
                          const isValidated = usernameResult.summary.available?.includes(email);
                          return (
                            <div key={idx} className={`bg-white p-2 rounded border ${
                              isValidated ? 'border-green-300' : 'border-gray-300'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm">{email}</span>
                                {isValidated && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Validated</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(usernameResult.summary.allGenerated.join('\n'));
                            alert('All generated emails copied to clipboard!');
                          }}
                          className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Copy All Emails
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Send Email Section - Auto-populated with ALL generated emails */}
              {usernameResult.summary?.allGenerated && usernameResult.summary.allGenerated.length > 0 && (
                <div className="bg-white border-2 border-blue-200 rounded-lg p-6 mt-6">
                  <h3 className="font-bold text-xl mb-4 text-blue-800">
                    📧 Send Email to Available Addresses
                  </h3>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Emails are sent via SMTP (smtp.hostinger.com) from info@closecheckvalidation.xyz
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Recipient - Auto-filled */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        To (Recipient Email Addresses)
                      </label>
                      <textarea
                        value={sendTo || (usernameResult.summary?.allGenerated?.join(', ') || '')}
                        onChange={(e) => setSendTo(e.target.value)}
                        rows={3}
                        className="border px-4 py-2 rounded w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {usernameResult.summary.allGenerated.length} email(s) auto-populated (including unvalidated). Emails will be sent to all addresses even if validation failed.
                      </p>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sendSubject}
                        onChange={(e) => setSendSubject(e.target.value)}
                        placeholder="Email subject"
                        className="border px-4 py-2 rounded w-full"
                      />
                    </div>

                    {/* Email Content */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email Content (HTML) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={sendContent}
                        onChange={(e) => setSendContent(e.target.value)}
                        placeholder="<h1>Hello!</h1>&#10;<p>This is your email content. You can use HTML.</p>"
                        rows={10}
                        className="border px-4 py-2 rounded w-full font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        You can use HTML tags for formatting
                      </p>
                    </div>

                    {/* From Email (Optional) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          From Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={sendFrom}
                          onChange={(e) => setSendFrom(e.target.value)}
                          placeholder="sender@yourdomain.com"
                          className="border px-4 py-2 rounded w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to use default from .env
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          From Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={sendFromName}
                          onChange={(e) => setSendFromName(e.target.value)}
                          placeholder="Your Name"
                          className="border px-4 py-2 rounded w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Display name for sender
                        </p>
                      </div>
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={sendEmail}
                      disabled={sendLoading || !sendSubject.trim() || !sendContent.trim()}
                      className="w-full bg-green-500 text-white px-6 py-3 rounded disabled:opacity-50 hover:bg-green-600 font-medium"
                    >
                      {sendLoading ? 'Sending...' : `Send Email to ${usernameResult.summary.allGenerated.length} Address(es)`}
                    </button>
                  </div>

                  {/* Send Email Results */}
                  {sendResult && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      sendResult.success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      {sendResult.success ? (
                        <div>
                          <h4 className="font-bold text-lg text-green-800 mb-2">✓ Email Sent Successfully!</h4>
                          <div className="space-y-1 text-sm">
                            {sendResult.messageId && <p><strong>Message ID:</strong> {sendResult.messageId}</p>}
                            <p><strong>To:</strong> {Array.isArray(sendResult.to) ? sendResult.to.join(', ') : sendResult.to}</p>
                            <p><strong>From:</strong> {sendResult.from}</p>
                            <p><strong>Sent at:</strong> {new Date(sendResult.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-bold text-lg text-red-800 mb-2">✗ Failed to Send Email</h4>
                          <p className="text-red-700">{sendResult.error}</p>
                          {sendResult.suggestion && (
                            <p className="text-sm text-red-600 mt-2">{sendResult.suggestion}</p>
                          )}
                          {sendResult.details && (
                            <pre className="text-xs mt-2 bg-red-100 p-2 rounded overflow-auto">
                              {JSON.stringify(sendResult.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {usernameResult.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Error: {usernameResult.error}</p>
                  {usernameResult.suggestion && (
                    <p className="text-sm text-red-600 mt-2">{usernameResult.suggestion}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Single Email Verification */}
      {activeTab === 'single' && (
        <>
          <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email to verify"
          className="border px-4 py-2 rounded flex-1"
        />
        <button
          onClick={verifyEmail}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary Result */}
          <div className={`p-4 rounded ${
            result.exists === true ? 'bg-green-100 border-2 border-green-500' : 
            result.exists === false ? 'bg-red-100 border-2 border-red-500' : 
            'bg-yellow-100 border-2 border-yellow-500'
          }`}>
            <p className="font-bold text-lg">
              {result.exists === true ? '✓ Email is valid' : 
               result.exists === false ? '✗ Email is invalid' : 
               '⚠ Unable to verify email'}
            </p>
            {result.reason && <p className="text-sm mt-2">{result.reason}</p>}
            {result.note && <p className="text-sm mt-2 italic">{result.note}</p>}
          </div>

          {/* Detailed Breakdown (Hunter.io style) */}
          {result.details && (
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-lg mb-4">Verification Details</h3>
              
              {/* Format */}
              <div className="border-b pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">Format</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    result.details.format === 'valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.details.format === 'valid' ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {result.details.format === 'valid' 
                    ? 'This email address has the correct format and is not gibberish.'
                    : 'This email address has an invalid format.'}
                </p>
              </div>

              {/* Type */}
              <div className="border-b pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">Type</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    result.details.type === 'webmail' ? 'bg-yellow-100 text-yellow-800' :
                    result.details.type === 'generic' ? 'bg-blue-100 text-blue-800' :
                    result.details.type === 'disposable' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.details.type === 'webmail' ? 'Webmail' :
                     result.details.type === 'generic' ? 'Generic' :
                     result.details.type === 'disposable' ? 'Disposable' : 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {result.details.type === 'webmail' 
                    ? 'This is a webmail email address. This domain name is used to create personal email addresses.'
                    : result.details.type === 'generic'
                    ? 'This is a generic/corporate email address.'
                    : result.details.type === 'disposable'
                    ? 'This is a disposable/temporary email address.'
                    : 'Email type could not be determined.'}
                </p>
              </div>

              {/* Server Status */}
              <div className="border-b pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">Server Status</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    result.details.serverStatus === 'valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.details.serverStatus === 'valid' ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {result.details.serverStatus === 'valid'
                    ? 'MX records are present for the domain and we can connect to the SMTP server these MX records point to.'
                    : 'No MX records found or cannot connect to the SMTP server.'}
                </p>
              </div>

              {/* Email Status */}
              <div className="pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">Email Status</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    result.details.emailStatus === 'valid' ? 'bg-green-100 text-green-800' :
                    result.details.emailStatus === 'invalid' ? 'bg-red-100 text-red-800' :
                    result.details.emailStatus === 'accept_all' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.details.emailStatus === 'valid' ? 'Valid' :
                     result.details.emailStatus === 'invalid' ? 'Invalid' :
                     result.details.emailStatus === 'accept_all' ? 'Accept All' : 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {result.details.emailStatus === 'valid'
                    ? 'This email address can receive emails.'
                    : result.details.emailStatus === 'invalid'
                    ? 'This email address cannot receive emails.'
                    : result.details.emailStatus === 'accept_all'
                    ? 'The server accepts all emails (cannot verify specific address).'
                    : 'Email status could not be determined.'}
                </p>
              </div>

              {/* Additional Info */}
              {(result.details.score !== undefined || result.details.sources !== undefined) && (
                <div className="pt-3 border-t text-sm text-gray-600">
                  {result.details.score !== undefined && (
                    <p>Confidence Score: {result.details.score}%</p>
                  )}
                  {result.details.sources !== undefined && result.details.sources > 0 && (
                    <p>Found in {result.details.sources} source(s)</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Basic Info (if no detailed breakdown) */}
          {!result.details && (
            <div className="bg-white border rounded-lg p-4 space-y-2">
              {result.mailServer && <p className="text-sm"><strong>Mail Server:</strong> {result.mailServer}</p>}
              {result.mxRecords && <p className="text-sm"><strong>MX Records:</strong> {result.mxRecords} found</p>}
              {result.method && <p className="text-sm"><strong>Method:</strong> {result.method}</p>}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Bulk Verification */}
      {activeTab === 'bulk' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enter Usernames (one per line, or separated by commas/spaces)
            </label>
            <textarea
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              placeholder="john&#10;jane&#10;doe"
              rows={10}
              className="border px-4 py-2 rounded w-full font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Each username will be checked with @gmail.com, @yahoo.com, @outlook.com, and @hotmail.com
            </p>
          </div>
          
          <button
            onClick={verifyBulk}
            disabled={bulkLoading || !usernames.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
          >
            {bulkLoading ? `Verifying... (${progress.current}/${progress.total})` : 'Verify All'}
          </button>

          {bulkLoading && progress.total > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
          )}

          {bulkResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold ml-2">{bulkResult.summary?.total || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Deliverable:</span>
                    <span className="font-bold ml-2 text-green-700">{bulkResult.summary?.deliverable || 0}</span>
                  </div>
                  <div>
                    <span className="text-red-600">Non-deliverable:</span>
                    <span className="font-bold ml-2 text-red-700">{bulkResult.summary?.nonDeliverable || 0}</span>
                  </div>
                  <div>
                    <span className="text-yellow-600">Unknown:</span>
                    <span className="font-bold ml-2 text-yellow-700">{bulkResult.summary?.unknown || 0}</span>
                  </div>
                </div>
              </div>

              {/* Deliverable Emails */}
              {bulkResult.deliverable && bulkResult.deliverable.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 text-green-800">
                    ✓ Deliverable Emails ({bulkResult.deliverable.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {bulkResult.deliverable.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border border-green-200">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-medium">{item.email}</span>
                          {item.score && (
                            <span className="text-xs text-gray-500">Score: {item.score}</span>
                          )}
                        </div>
                        {item.reason && (
                          <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const emails = bulkResult.deliverable.map((item: any) => item.email).join('\n');
                      navigator.clipboard.writeText(emails);
                      alert('Deliverable emails copied to clipboard!');
                    }}
                    className="mt-3 text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Copy All Deliverable Emails
                  </button>
                </div>
              )}

              {/* Non-deliverable Emails */}
              {bulkResult.nonDeliverable && bulkResult.nonDeliverable.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 text-red-800">
                    ✗ Non-deliverable Emails ({bulkResult.nonDeliverable.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {bulkResult.nonDeliverable.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border border-red-200">
                        <span className="font-mono text-sm">{item.email}</span>
                        {item.reason && (
                          <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown Emails */}
              {bulkResult.unknown && bulkResult.unknown.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 text-yellow-800">
                    ⚠ Unknown Status ({bulkResult.unknown.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {bulkResult.unknown.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border border-yellow-200">
                        <span className="font-mono text-sm">{item.email}</span>
                        {item.reason && (
                          <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

