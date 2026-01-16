# Self-Hosted Email Verification

A Next.js application that verifies email addresses by checking MX records and performing SMTP verification.

## Features

- Email format validation
- MX record lookup
- SMTP server verification
- Real-time verification results

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory with your SMTP credentials and Mails.so API key:

```env
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host.com
MAIL_PORT=587
MAIL_USERNAME=your-email@domain.com
MAIL_PASSWORD=your-password
MAIL_FROM_ADDRESS=your-email@domain.com
MAIL_FROM_NAME=Email Verifier
APP_NAME=Email Verifier

# Mails.so API Key for email verification (required)
# Get your API key from https://mails.so
MAILS_API_KEY=your-mails-api-key-here
```

**Note**: The `.env.local` file is already in `.gitignore` and will not be committed to version control.

## Verification Methods

The application uses a comprehensive multi-layered approach to verify emails:

1. **Mails.so API** (if configured): Primary verification method using Mails.so's email verification API
2. **Format Validation**: Checks if the email follows a valid format
3. **Disposable Email Detection**: Identifies temporary/disposable email services
4. **Webmail Provider Detection**: Recognizes major webmail providers (Gmail, Yahoo, etc.)
5. **MX Record Lookup**: Verifies domain has valid mail exchange records
6. **SMTP Verification**: Attempts direct SMTP connection (when possible)
7. **Authenticated SMTP**: Uses your SMTP credentials for more reliable verification

The system uses Mails.so API if configured, otherwise falls back to comprehensive checks to provide a confidence score and detailed verification results.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## How It Works

1. **Format Validation**: Checks if the email follows a valid format
2. **MX Record Lookup**: Queries DNS for mail exchange records
3. **SMTP Verification**: Connects to the mail server and verifies if the email address exists

## API Endpoints

### POST `/api/verify-email`

Verify a single email address.

Request body:
```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "exists": true,
  "verified": true,
  "mxRecords": 1,
  "mailServer": "mail.example.com",
      "reason": "Email is deliverable and can receive emails",
      "method": "mails",
  "details": {
    "format": "valid",
    "type": "webmail",
    "serverStatus": "valid",
    "emailStatus": "valid",
    "score": 95
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "duration": "250ms"
}
```

### GET `/api/health`

Health check endpoint to verify API configuration.

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Email Verification API",
  "mails": {
    "configured": true,
    "keyPreview": "aa885ec2-f7..."
  },
  "endpoints": [
    "POST /api/verify-email - Verify single email",
    "GET /api/health - Health check",
    "GET /api/test - Test integration"
  ]
}
```

### GET `/api/test`

Test endpoint to verify API integration (currently tests Mails.so API).

Response:
```json
{
  "test": "Mails.so API Integration Test",
  "email": "test@gmail.com",
  "result": {
    "success": true,
    "result": "valid",
    "score": 95
  },
  "note": "If this works, your API key is valid!",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Notes

- SMTP verification may be blocked by some mail servers
- Some servers may rate limit verification attempts
- Results may vary depending on server configurations

