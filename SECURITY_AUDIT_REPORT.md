# Security Audit Report - MyTeacher Institute Backend

**Date:** 2026-07-08  
**Auditor:** Security Review Team  
**Status:** Critical Issues Identified - DO NOT DEPLOY TO PRODUCTION

---

## Executive Summary

This security audit has identified **CRITICAL** and **HIGH SEVERITY** vulnerabilities that could compromise user data, enable unauthorized access, and expose sensitive information. The application should NOT be deployed to production until these issues are addressed.

**Critical Issues Found:** 15  
**High Severity Issues:** 8  
**Medium Severity Issues:** 12  
**Low Severity Issues:** 5

---

## CRITICAL SECURITY VULNERABILITIES

### 1. 🔴 **WEAK PASSWORD REQUIREMENTS**
**File:** `src/services/auth.service.ts`, `src/utils/index.ts`  
**Severity:** CRITICAL  
**Lines:** 159-161, 90-95

**Issue:**
```typescript
if (password.length < 6) {
    return { status: 400, body: { status: 'failed', message: 'Password must be at least 6 characters', errorOnInput: true } };
}
```

**Problem:**
- Minimum password length is only 6 characters (industry standard is 8-12)
- No complexity requirements (uppercase, lowercase, numbers, special characters)
- No check for common/weak passwords
- Vulnerable to brute force attacks

**Impact:** Users can create extremely weak passwords like "123456" or "password"

---

### 2. 🔴 **MISSING RATE LIMITING ON AUTHENTICATION ENDPOINTS**
**File:** `src/routes/auth.routes.ts`, `src/routes/admin.routes.ts`  
**Severity:** CRITICAL

**Issue:**
- No rate limiting middleware on login endpoints
- No account lockout mechanism after failed attempts
- OTP rate limiting exists but password attempts are unlimited

**Problem:**
```typescript
router.post("/login", handleAdminLogin); // No rate limiting
router.post('/verify-otp', handleVerifyAdminOtp); // No rate limiting
```

**Impact:** Vulnerable to brute force attacks on user accounts

---

### 3. 🔴 **SENSITIVE CREDENTIALS IN PLAINTEXT EMAIL**
**File:** `src/services/email.service.ts`  
**Severity:** CRITICAL  
**Lines:** 179-182

**Issue:**
```typescript
<p style="margin: 10px 0;"><strong>Password:</strong> ${adminData.password}</p>
```

**Problem:**
- Admin passwords sent via email in plaintext
- Email is not encrypted end-to-end
- Passwords can be intercepted or stored in email logs
- Violates security best practices (OWASP, NIST)

**Impact:** Admin credentials could be intercepted, compromising entire system

---

### 4. 🔴 **JWT SECRET KEYS ALLOW EMPTY STRINGS**
**File:** `src/config/env.ts`  
**Severity:** CRITICAL  
**Lines:** 11-13

**Issue:**
```typescript
JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET ?? "",
JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET ?? "",
REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME ?? "",
```

**Problem:**
- Empty strings allowed as fallback for JWT secrets
- Application will start with no secret, making tokens predictable/forgeable
- No validation to ensure secrets are set

**Impact:** Complete authentication bypass possible if secrets not configured

---

### 5. 🔴 **INSECURE SESSION MANAGEMENT**
**File:** `src/middleware/protect-route.ts`  
**Severity:** CRITICAL  
**Lines:** 46-58

**Issue:**
```typescript
if (refreshToken) {
    try {
        const refreshDecoded = jwt.verify(refreshToken, refreshTokenSecret) as { userId: string };
        const newAccessToken = jwt.sign({ userId: refreshDecoded.userId }, accessTokenSecret, {
            expiresIn: '1d',
        });
        // No sessionId validation
        req.userId = refreshDecoded.userId;
        res.setHeader('Authorization', `Bearer ${newAccessToken}`);
        return next();
    }
}
```

**Problems:**
- Refresh token decoded but sessionId not verified against database
- No check if session is revoked or expired in database
- Session hijacking possible even after user logs out
- New access tokens created without validating session state

**Impact:** Stolen refresh tokens remain valid even after logout

---

### 6. 🔴 **INCONSISTENT SESSION VALIDATION**
**File:** `src/services/token.service.ts` vs `src/middleware/protect-route.ts`  
**Severity:** CRITICAL

**Issue:**
- `token.service.ts` extracts sessionId from JWT but never validates it
- `protect-route.ts` doesn't check sessionId at all in refresh flow
- No database lookup to verify session exists/is valid

**Impact:** Revoked sessions can still be used to generate new tokens

---

### 7. 🔴 **OTP TIMING ATTACK VULNERABILITY**
**File:** `src/services/otp.service.ts`  
**Severity:** CRITICAL  
**Lines:** 23-27

**Issue:**
```typescript
const findOtp = await Otp.findOne({ otp });
if (!findOtp) {
    return { status: 400, body: { status: 'failed', message: '...' } };
}
```

**Problem:**
- Direct string comparison of OTP codes
- Vulnerable to timing attacks
- Attacker can determine if OTP exists based on response time

**Impact:** OTP enumeration and brute force attacks possible

---

### 8. 🔴 **CORS MISCONFIGURATION**
**File:** `src/app.ts`  
**Severity:** CRITICAL  
**Lines:** 13-16

**Issue:**
```typescript
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true,
}));
```

**Problems:**
- Hardcoded origin, no production URL handling
- No dynamic origin validation
- Credentials enabled without proper origin validation

**Impact:** Cross-origin attacks possible if misconfigured in production

---

### 9. 🔴 **MISSING CSRF PROTECTION**
**File:** `src/app.ts`  
**Severity:** CRITICAL

**Issue:**
- No CSRF token implementation
- Cookie-based authentication without CSRF protection
- State-changing operations vulnerable

**Impact:** Cross-Site Request Forgery attacks possible

---

### 10. 🔴 **SQL/NoSQL INJECTION VULNERABILITIES**
**File:** Multiple controllers  
**Severity:** CRITICAL

**Issue:**
```typescript
// src/services/otp.service.ts
const findOtp = await Otp.findOne({ otp }); // Direct user input

// src/services/admin.services.ts
const admin = await Admin.findOne({ email }); // User input
```

**Problem:**
- Direct use of user input in database queries
- No input sanitization or validation against NoSQL injection
- Vulnerable to MongoDB operator injection ($gt, $ne, etc.)

**Impact:** Unauthorized data access, authentication bypass

---

### 11. 🔴 **EXPOSED SENSITIVE DATA IN LOGS**
**File:** `src/services/token.service.ts`, `src/services/email.service.ts`  
**Severity:** CRITICAL

**Issue:**
```typescript
console.log('[getAccessToken] Cookie name:', refreshCookieName);
logger.info(`OTP generated for user ${userId}: ${otpCode}`);
```

**Problem:**
- OTP codes logged to console
- Authentication tokens logged
- Sensitive data in application logs

**Impact:** Sensitive data exposed in log files

---

### 12. 🔴 **FILE PATH INJECTION VULNERABILITY**
**File:** `src/controllers/youtube-upload.controller.ts`  
**Severity:** CRITICAL  
**Lines:** 43-49

**Issue:**
```typescript
const { videoPath, title, description, tags, privacyStatus } = req.body;

// Check if video file exists
if (!fs.existsSync(videoPath)) {
    return res.status(404).json({...});
}
```

**Problem:**
- User-controlled file path with no validation
- Can read any file on server using path traversal
- No restriction on file location
- Arbitrary file system access

**Impact:** Complete server file system exposure, read /etc/passwd, .env files, etc.

---

### 13. 🔴 **INSECURE OAUTH STATE HANDLING**
**File:** `src/controllers/youtube-upload.controller.ts`  
**Severity:** CRITICAL  
**Lines:** 145-148, 169-172

**Issue:**
```typescript
// Generate state
const state = Buffer.from(JSON.stringify({ instructorId })).toString('base64');

// Decode state
const { instructorId } = JSON.parse(Buffer.from(state as string, 'base64').toString());
```

**Problems:**
- State parameter not cryptographically signed
- No verification that state wasn't tampered with
- Attacker can forge state to link OAuth tokens to different user
- No CSRF protection in OAuth flow

**Impact:** OAuth token theft, account takeover

---

### 14. 🔴 **SENSITIVE API KEYS IN ENVIRONMENT WITHOUT VALIDATION**
**File:** `src/config/env.ts`, `.env.example`  
**Severity:** CRITICAL

**Issue:**
- Flutterwave API keys with empty string fallbacks
- Google OAuth secrets with no validation
- Application runs with empty secrets

**Impact:** Payment system vulnerabilities, OAuth bypass

---

### 15. 🔴 **MISSING INPUT VALIDATION ON PHONE NUMBER**
**File:** `src/services/auth.service.ts`  
**Severity:** HIGH  
**Lines:** 169-172

**Issue:**
```typescript
const phoneRegex = /^[0-9]{10}$/;
if (!phoneRegex.test(phone)) {
    return { status: 400, body: { status: 'failed', message: 'Invalid phone number format', errorOnInput: true } };
}
```

**Problems:**
- Only validates exactly 10 digits
- No country code support
- No international number validation
- Rejects valid numbers with country codes

---

## HIGH SEVERITY ISSUES

### 16. 🟠 **RACE CONDITION IN OTP DELETION**
**File:** `src/services/otp.service.ts`  
**Severity:** HIGH  
**Lines:** 30-32

**Issue:**
```typescript
const findOtp = await Otp.findOne({ otp });
if (!findOtp) { return ...; }
await findOtp.deleteOne();
```

**Problem:**
- OTP is found, then deleted
- Race condition: same OTP can be used multiple times in parallel requests
- No atomic operation

**Impact:** OTP reuse attack, multiple logins from single OTP

---

### 17. 🟠 **TRANSACTION VERIFICATION VULNERABILITY**
**File:** `src/controllers/payment.controller.ts`  
**Severity:** HIGH  
**Lines:** 116-138

**Issue:**
```typescript
const transaction = await Transaction.findOne({ transactionReference: tx_ref });

if (transaction.status === 'successful') {
    return res.status(200).json({...});
}

const verificationResponse = await verifyTransaction(transaction_id);
```

**Problems:**
- No verification that transaction amount matches course price
- No verification that transaction belongs to requesting user
- Race condition in status update
- User can verify another user's transaction

**Impact:** Payment fraud, unauthorized course access

---

### 18. 🟠 **PRIVILEGE ESCALATION VIA ROLE FIELD**
**File:** `src/models/user.model.ts`  
**Severity:** HIGH  
**Lines:** 37-40

**Issue:**
```typescript
role: {
    type: String,
    enum: ["user", "instructor", "admin"]
}
```

**Problem:**
- Role field directly modifiable
- No validation on role assignment during registration
- User could potentially set role to "admin" during registration

**Impact:** Unauthorized admin access

---

### 19. 🟠 **UNLIMITED SESSION CREATION**
**File:** `src/services/session.service.ts`  
**Severity:** HIGH  
**Lines:** 128-131

**Issue:**
```typescript
if (countSessions >= 12) {
    return { isSuccessful: false, reason: 'Too many sessions' };
}
```

**Problem:**
- Limit is 12 sessions per user (too high)
- No automatic cleanup of old sessions
- Attacker can create 12 sessions, then lock out legitimate user

**Impact:** Denial of service, resource exhaustion

---

### 20. 🟠 **INSECURE PASSWORD RESET FLOW**
**File:** `src/services/otp.service.ts`  
**Severity:** HIGH  
**Lines:** 133-161

**Issue:**
```typescript
const findOtp = await Otp.findOne({ userId: findUser._id, useCase: 'reset-password', isUsed: false });

if (findOtp) {
    if (findOtp.sendAttempts > 4) {
        return { status: 429, body: {...} };
    }
    // Updates existing OTP
}
```

**Problems:**
- Old OTP not deleted before creating new one
- Multiple valid OTPs can exist simultaneously
- Logic error: deletes old OTPs AFTER creating new one
- Race condition between check and delete

**Impact:** Multiple valid reset tokens, account takeover

---

### 21. 🟠 **UNVALIDATED REDIRECT IN PAYMENT**
**File:** `src/controllers/payment.controller.ts`  
**Severity:** HIGH  
**Lines:** 77-78

**Issue:**
```typescript
redirect_url: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
```

**Problem:**
- User-controlled redirect URL
- No validation of redirect domain
- Open redirect vulnerability

**Impact:** Phishing attacks, credential theft

---

### 22. 🟠 **MONGODB OPERATOR INJECTION**
**File:** Multiple services  
**Severity:** HIGH

**Issue:**
```typescript
const findUser = await User.findOne({ email });
// If email = { $ne: null }, returns first user
```

**Problem:**
- No input sanitization for MongoDB operators
- Can bypass authentication with object injection

**Impact:** Authentication bypass, unauthorized data access

---

### 23. 🟠 **MISSING AUTHORIZATION CHECKS**
**File:** `src/controllers/payment.controller.ts`  
**Severity:** HIGH  
**Lines:** 211-223

**Issue:**
```typescript
export const handleGetTransactionByRef = async (req: Request<{ tx_ref: string }>, res: Response) => {
    const { tx_ref } = req.params;
    const transaction = await Transaction.findOne({ transactionReference: tx_ref })
    // No check if transaction belongs to requesting user
}
```

**Problem:**
- Any authenticated user can view any transaction
- No ownership validation

**Impact:** Unauthorized access to payment information

---

## MEDIUM SEVERITY ISSUES

### 24. 🟡 **PREDICTABLE TRANSACTION REFERENCES**
**File:** `src/controllers/payment.controller.ts`  
**Severity:** MEDIUM  
**Line:** 59

**Issue:**
```typescript
const transactionReference = generateTransactionReference(userId, courseId);
```

**Problem:**
- If reference is predictable, transactions can be enumerated
- Need to verify implementation

---

### 25. 🟡 **INSUFFICIENT OTP EXPIRY VALIDATION**
**File:** `src/models/otp.model.ts`  
**Severity:** MEDIUM  
**Lines:** 44-47

**Issue:**
```typescript
expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
}
```

**Problem:**
- Expiry check happens in application, not at database level
- TTL index cleanup happens 1 hour after expiry
- Expired OTPs remain usable for up to 1 hour after expiry

---

### 26. 🟡 **WEAK EMAIL VALIDATION**
**File:** Multiple services  
**Severity:** MEDIUM

**Issue:**
```typescript
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
```

**Problem:**
- Regex doesn't cover all valid email formats
- Doesn't prevent disposable emails
- No email verification for actual deliverability

---

### 27. 🟡 **MISSING HELMET SECURITY HEADERS**
**File:** `src/app.ts`  
**Severity:** MEDIUM

**Issue:**
- No Helmet middleware for security headers
- Missing X-Frame-Options, X-Content-Type-Options, etc.

**Impact:** Clickjacking, MIME sniffing attacks

---

### 28. 🟡 **CONSOLE.LOG IN PRODUCTION**
**File:** Multiple files  
**Severity:** MEDIUM

**Issue:**
- Extensive use of console.log throughout codebase
- Should use proper logging with log levels
- Performance impact in production

---

### 29. 🟡 **NO REQUEST SIZE LIMITS**
**File:** `src/app.ts`  
**Severity:** MEDIUM  
**Lines:** 18-19

**Issue:**
```typescript
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
```

**Problem:**
- 100MB limit is extremely high
- Enables denial of service attacks via large payloads

---

### 30. 🟡 **MISSING CONTENT-TYPE VALIDATION**
**File:** All controllers  
**Severity:** MEDIUM

**Issue:**
- No validation of Content-Type header
- Accepts any content type

---

### 31. 🟡 **HARDCODED EMAIL IN CODE**
**File:** `src/services/email.service.ts`  
**Severity:** MEDIUM  
**Line:** 138

**Issue:**
```typescript
to: 'myteacheronlineclass1@gmail.com',
```

**Problem:**
- Hardcoded email address
- Should be in environment variables

---

### 32. 🟡 **NO DATABASE CONNECTION ERROR HANDLING**
**File:** General architecture issue  
**Severity:** MEDIUM

**Issue:**
- No graceful handling of database connection failures
- Application may crash on DB disconnect

---

### 33. 🟡 **SOCKET AUTHENTICATION BYPASS**
**File:** `src/config/socket.ts`  
**Severity:** MEDIUM  
**Lines:** 19-23

**Issue:**
```typescript
const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
```

**Problem:**
- Accepts token from multiple sources without preference
- Could lead to authentication confusion

---

### 34. 🟡 **MISSING INPUT LENGTH LIMITS**
**File:** Multiple services  
**Severity:** MEDIUM

**Issue:**
- No maximum length validation on name, title, description fields
- Enables storage exhaustion attacks

---

### 35. 🟡 **BCRYPT ROUNDS TOO LOW**
**File:** `src/services/auth.service.ts`, others  
**Severity:** MEDIUM

**Issue:**
```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

**Problem:**
- 10 rounds is on the lower end
- Industry standard is 12-14 rounds

---

## LOW SEVERITY ISSUES

### 36. ⚪ **DUPLICATE CODE**
**Files:** `src/utils/index.ts`  
**Severity:** LOW

**Issue:**
- `generateJWT` and `generateJWTCookie` duplicate functionality
- Maintenance burden

---

### 37. ⚪ **INCONSISTENT ERROR MESSAGES**
**File:** Multiple  
**Severity:** LOW

**Issue:**
- Some errors return detailed messages, others generic
- Information disclosure risk

---

### 38. ⚪ **NO API VERSIONING**
**File:** `src/app.ts`  
**Severity:** LOW

**Issue:**
- Routes like `/api/auth` should be `/api/v1/auth`
- Difficult to maintain backward compatibility

---

### 39. ⚪ **MISSING REQUEST ID**
**File:** General  
**Severity:** LOW

**Issue:**
- No request ID for tracing
- Difficult to debug issues

---

### 40. ⚪ **NO HEALTH CHECK ENDPOINT**
**File:** `src/app.ts`  
**Severity:** LOW

**Issue:**
- Only root endpoint returns status
- Should have dedicated /health endpoint

---

## LOGICAL ERRORS

### 41. **Unused createNotification Import**
**File:** `src/services/auth.service.ts`  
**Line:** 8

**Issue:**
```typescript
import { createNotification } from './notification.service';
// Never used in file
```

---

### 42. **OTP Delete Logic Error**
**File:** `src/services/otp.service.ts`  
**Lines:** 176-177

**Issue:**
```typescript
await Otp.create({...});
await Otp.deleteMany({ userId: findUser._id, useCase: 'reset-password', isUsed: false });
```

**Problem:**
- Creates new OTP
- Then deletes all OTPs for that use case
- Deletes the OTP just created!
- Logic is backwards

---

### 43. **Inconsistent accountType Handling**
**File:** Multiple OTP services  
**Severity:** MEDIUM

**Issue:**
- Some functions accept accountType parameter
- Others default to 'user'
- Inconsistent behavior

---

### 44. **Password Required but Optional for OAuth**
**File:** `src/models/user.model.ts`  
**Lines:** 5-9

**Issue:**
```typescript
password: {
    type: String,
    required: true,
    minlength: 6
}
```

**Problem:**
- Password marked as required
- OAuth users may not have passwords
- Will cause registration failures for OAuth

---

### 45. **Session Expiry Inconsistency**
**File:** Token vs Session expiry  
**Severity:** MEDIUM

**Issue:**
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days  
- Sessions expire in 1 month
- Mismatched expiration policies

---

## RECOMMENDATIONS

### Immediate Actions (Critical):
1. ✅ Implement strong password policy (min 8 chars, complexity requirements)
2. ✅ Add rate limiting to all authentication endpoints
3. ✅ Remove plaintext passwords from emails (use password reset flow)
4. ✅ Add validation for JWT secrets (fail if not set)
5. ✅ Implement proper session validation in middleware
6. ✅ Fix file path injection vulnerability (whitelist directories)
7. ✅ Add CSRF protection
8. ✅ Sanitize all database query inputs
9. ✅ Use constant-time comparison for OTP validation
10. ✅ Fix OAuth state signing/verification

### Short-term (High Priority):
1. Implement proper authorization checks on all endpoints
2. Add transaction ownership validation
3. Fix OTP deletion race condition (use atomic operations)
4. Reduce max JSON payload size to 10MB
5. Add security headers (Helmet)
6. Implement proper logging system
7. Add input length limits
8. Increase bcrypt rounds to 12

### Medium-term:
1. Add API versioning
2. Implement request tracing
3. Add health check endpoints
4. Reduce session limit to 5
5. Add email verification for deliverability
6. Implement proper error handling
7. Add MongoDB operator sanitization library

### Long-term:
1. Security audit by third party
2. Penetration testing
3. Implement WAF
4. Add anomaly detection
5. Implement security monitoring

---

## CONCLUSION

This application has **CRITICAL security vulnerabilities** that must be addressed before production deployment. The most serious issues include:

- Weak authentication mechanisms
- Missing authorization checks  
- Insecure session management
- Sensitive data exposure
- File system vulnerabilities
- Payment system vulnerabilities

**Recommendation:** **DO NOT DEPLOY TO PRODUCTION** until critical and high-severity issues are resolved.

---

**Report Generated:** 2026-07-08 21:56:00 UTC  
**Files Analyzed:** 25+  
**Total Issues:** 45  
**Risk Level:** CRITICAL









<!-- 
when mongoddb face disconnect due to network or error it does not reconnect ✗ MongoDB connection failed: MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted. Make sure your current IP address is on your Atlas cluster's IP whitelist: https://www.mongodb.com/docs/atlas/security-whitelist/
    at _handleConnectionErrors (C:\Users\HP\Desktop\client_space\myteacher-institute-backend\node_modules\.pnpm\mongoose@9.6.1\node_modules\mongoose\lib\connection.js:1180:11)
    at NativeConnection.openUri (C:\Users\HP\Desktop\client_space\myteacher-institute-backend\node_modules\.pnpm\mongoose@9.6.1\node_modules\mongoose\lib\connection.js:1111:11)
    at async connectDB (C:\Users\HP\Desktop\client_space\myteacher-institute-backend\src\config\database.ts:6:9)
    at async startServer (C:\Users\HP\Desktop\client_space\myteacher-institute-backend\src\server.ts:13:9) {  
  errorLabelSet: Set(0) {},
  reason: TopologyDescription {
    type: 'ReplicaSetNoPrimary',
    servers: Map(3) {
      'ac-ix0qeo8-shard-00-01.syc52qv.mongodb.net:27017' => [ServerDescription],
      'ac-ix0qeo8-shard-00-00.syc52qv.mongodb.net:27017' => [ServerDescription],
      'ac-ix0qeo8-shard-00-02.syc52qv.mongodb.net:27017' => [ServerDescription]
    },
    stale: false,
    compatible: true,
    heartbeatFrequencyMS: 10000,
    localThresholdMS: 15,
    setName: 'atlas-sh3vky-shard-0',
    maxElectionId: null,
    maxSetVersion: null,
    commonWireVersion: 0,
    logicalSessionTimeoutMinutes: null
  },
  code: undefined,
  cause: TopologyDescription {
    type: 'ReplicaSetNoPrimary',
    servers: Map(3) {
      'ac-ix0qeo8-shard-00-01.syc52qv.mongodb.net:27017' => [ServerDescription],
      'ac-ix0qeo8-shard-00-00.syc52qv.mongodb.net:27017' => [ServerDescription],
      'ac-ix0qeo8-shard-00-02.syc52qv.mongodb.net:27017' => [ServerDescription]
    },
    stale: false,
    compatible: true,
    heartbeatFrequencyMS: 10000,
    localThresholdMS: 15,
    setName: 'atlas-sh3vky-shard-0',
    maxElectionId: null,
    maxSetVersion: null,
    commonWireVersion: 0,
    logicalSessionTimeoutMinutes: null
  }
}
[nodemon] app crashed - waiting for file changes before starting...
try and implemnt it -->
