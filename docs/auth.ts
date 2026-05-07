/**
 * @swagger
 * /auth/initiate:
 *   post:
 *     summary: Initiate authentication process
 *     description: |
 *       Starts the authentication process by checking if user exists.
 *       - If user exists and is onboarded: returns 'give-password' instruction
 *       - If user exists but not onboarded: sends OTP and returns 'give-code' instruction  
 *       - If user doesn't exist: creates new user, sends OTP and returns 'give-code' instruction
 *       
 *       **⚠️ Important Email Limitation**: 
 *       During development/testing, emails can only be sent to `myteacheronlineclass1@gmail.com`.
 *       To send emails to other recipients, you must:
 *       1. Verify a domain at resend.com/domains
 *       2. Update the `from` address to use your verified domain
 *       3. Configure the `NO_REPLY_EMAIL` environment variable
 *       
 *       Attempting to send to other emails will result in an error.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: user@example.com
 *     responses:
 *       '200':
 *         description: Authentication initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success]
 *                     instruction:
 *                       type: string
 *                       enum: [give-password]
 *                     message:
 *                       type: string
 *                       example: User onboarded, password required
 *                   description: User exists and is onboarded - password required
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success]
 *                     instruction:
 *                       type: string
 *                       enum: [give-code]
 *                     message:
 *                       type: string
 *                       example: An OTP code has been sent to your email. Please verify to continue.
 *                   description: OTP sent - verification required
 *       '400':
 *         description: Bad request - invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email is required
 *                 status:
 *                   type: string
 *                   enum: [failed]
 *       '429':
 *         description: Too many requests - rate limited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Too many attempts. Please wait 15 minutes to request another code.
 *                 status:
 *                   type: string
 *                   enum: [failed]
 *       '500':
 *         description: Internal server error or email service limitation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   oneOf:
 *                     - type: string
 *                       example: Failed to send verification email. Please try again.
 *                       description: General email service error
 *                     - type: string
 *                       example: You can only send testing emails to your own email address (myteacheronlineclass1@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.
 *                       description: Resend testing limitation error
 *                 status:
 *                   type: string
 *                   enum: [failed]
 */

/**
 * @swagger
 * /auth/verify-password:
 *   post:
 *     summary: Verify user password and authenticate
 *     description: |
 *       Verifies user password and handles authentication flow.
 *       - Validates email and password input
 *       - Checks if user exists and has onboarded
 *       - Compares password using bcrypt
 *       - Checks for trusted device sessions
 *       - For trusted devices: generates session and returns access token
 *       - For new devices: generates OTP for verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password (minimum 6 characters)
 *                 example: password123
 *     responses:
 *       '200':
 *         description: Password verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success]
 *                     isTrusted:
 *                       type: boolean
 *                       enum: [true]
 *                     message:
 *                       type: string
 *                       example: Welcome back! You have successfully logged in to your account.
 *                     access_code:
 *                       type: string
 *                       description: JWT access token for trusted devices
 *                   description: Trusted device - access granted with token
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success]
 *                     isTrusted:
 *                       type: boolean
 *                       enum: [false]
 *                     isGiveCode:
 *                       type: boolean
 *                       enum: [true]
 *                     isCompleted:
 *                       type: boolean
 *                       enum: [false]
 *                     message:
 *                       type: string
 *                       example: New device detected. Please verify with the code sent to your email.
 *                   description: New device - OTP verification required
 *       '400':
 *         description: Bad request - invalid input or credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   oneOf:
 *                     - type: string
 *                       enum: [email, password]
 *                     - type: boolean
 *                       enum: [false]
 *                 message:
 *                   type: string
 *                   enum:
 *                     - Email is required
 *                     - Password is required
 *                     - Email must be a string
 *                     - Password must be a string
 *                     - Password must be at least 6 characters long
 *                     - The password you entered is incorrect. Please try again.
 *                 status:
 *                   type: string
 *                   enum: [failed]
 *       '404':
 *         description: User not found or not onboarded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   type: boolean
 *                   enum: [false]
 *                 message:
 *                   type: string
 *                   example: Wrong endpoint. Please contact support.
 *                 status:
 *                   type: string
 *                   enum: [failed]
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errorOnInput:
 *                   type: boolean
 *                   enum: [false]
 *                 message:
 *                   type: string
 *                   example: Something unexpected happened. Please try again.
 *                 status:
 *                   type: string
 *                   enum: [failed]
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP code for authentication
 *     description: |
 *       Verifies OTP code and completes authentication process.
 *       - Validates OTP format (6 digits)
 *       - Finds OTP record and associated user
 *       - Handles both new-account and onboarded-account use cases
 *       - Generates session and access token upon successful verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit OTP code
 *                 example: '123456'
 *     responses:
 *       '200':
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                 message:
 *                   type: string
 *                   enum:
 *                     - Account verified successfully! Welcome aboard.
 *                     - Device verified successfully! You can now access your account.
 *                 authUser:
 *                   type: object
 *                   description: User object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     hasOnboarded:
 *                       type: boolean
 *                     isEmailVerified:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *       '400':
 *         description: Bad request - invalid OTP or user not found
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP is required and must be a string
 *                     status:
 *                       type: string
 *                       enum: [failed]
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP must be exactly 6 digits
 *                     status:
 *                       type: string
 *                       enum: [failed]
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: The verification code you entered is invalid or has expired. Please request a new one.
 *                     status:
 *                       type: string
 *                       enum: [failed]
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: User account not found. Please contact support.
 *                     status:
 *                       type: string
 *                       enum: [failed]
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Something unexpected happened. Try again later.
 *                     status:
 *                       type: string
 *                       enum: [failed]
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: SERVER_ERROR
 *                 status:
 *                   type: string
 *                   enum: [failed]
 */

/**
 * @swagger
 * /auth/new-access-code:
 *   get:
 *     summary: Generate new access token from refresh token
 *     description: |
 *       Generates a new access token using the refresh token from cookies.
 *       - Validates refresh token presence and format
 *       - Verifies refresh token using JWT secret
 *       - Generates new access token for authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Access token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [success]
 *                 message:
 *                   type: string
 *                   example: Access token generated successfully
 *                 accessToken:
 *                   type: string
 *                   description: New JWT access token
 *       '401':
 *         description: Authentication errors
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [no-refresh]
 *                     message:
 *                       type: string
 *                       example: No refresh token found. Please log in again.
 *                 - type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [invalid-refresh]
 *                     message:
 *                       type: string
 *                       example: Invalid or expired refresh token. Please log in again.
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [server-error]
 *                 message:
 *                   type: string
 *                   example: Internal server error occurred
 */
