/**
 * Jakson Solar – Full OpenAPI 3.0 Specification
 * Served at  GET /api/docs
 */

const swaggerDefinition = {
    openapi: '3.0.3',
    info: {
        title: 'Jakson Solar Investment Platform API',
        version: '1.0.0',
        description: `
## Overview
REST API for the **Jakson Solar** investment platform.
Users can register, top up their wallet via bank transfer, purchase solar-panel investment products, earn daily income, withdraw funds, and grow a referral team.

## Authentication
All protected routes require a **Bearer JWT token** in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <token>
\`\`\`
Obtain the token from \`POST /api/auth/login\` or \`POST /api/auth/register\`.

## Currency
- All monetary values are in **USD** unless noted.
- NGN equivalent is shown alongside using the live exchange rate stored in AppSettings.

## Withdrawal Rules
| Amount | Fee |
|---|---|
| < $500 | 10% |
| ≥ $500 | 20% |
- Once per day (Mon–Fri, 10:00 AM – 06:00 PM)
- Minimum $2.00

## Rate Limits
- Global: 200 requests / 15 min
- Auth endpoints: 20 requests / 15 min
    `,
        contact: {
            name: 'Jakson Solar Support',
            url: 'https://jaksonsolar.org',
        },
    },
    servers: [
        {
            url: 'http://localhost:5000/api',
            description: 'Local development server',
        },
        {
            url: 'https://api.jaksonsolar.org/api',
            description: 'Production server',
        },
    ],

    // ─── Security Schemes ──────────────────────────────────────
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description:
                    'JWT token obtained from /auth/login or /auth/register',
            },
        },

        // ─── Reusable Schemas ─────────────────────────────────────
        schemas: {
            // ── Success wrapper ──────────────────────────────────────
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Success' },
                },
            },

            // ── Error wrapper ────────────────────────────────────────
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                        type: 'string',
                        example: 'Something went wrong',
                    },
                },
            },

            // ── Pagination meta ──────────────────────────────────────
            Pagination: {
                type: 'object',
                properties: {
                    total: { type: 'integer', example: 42 },
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    pages: { type: 'integer', example: 3 },
                },
            },

            // ── User ─────────────────────────────────────────────────
            UserPublic: {
                type: 'object',
                description: 'Safe user object (no passwords)',
                properties: {
                    id: { type: 'string', example: '664a1f3b2e1a4c001f8d3b22' },
                    phone: { type: 'string', example: '90***2820' },
                    role: {
                        type: 'string',
                        enum: ['user', 'admin', 'superadmin'],
                        example: 'user',
                        description: 'Account role. Determines access level.',
                    },
                    referralCode: { type: 'string', example: 'AFM9VC' },
                    vipLevel: { type: 'integer', example: 0 },
                    balance: { type: 'number', example: 12.55 },
                    totalEarnings: { type: 'number', example: 5.3 },
                    todayEarnings: { type: 'number', example: 0.55 },
                    yesterdayEarnings: { type: 'number', example: 0.55 },
                    realName: { type: 'string', example: null, nullable: true },
                    idVerified: { type: 'boolean', example: false },
                    telegramJoined: { type: 'boolean', example: false },
                    lastCheckin: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    checkinStreak: { type: 'integer', example: 3 },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── UserAdmin ────────────────────────────────────────────
            // Full user object returned from admin endpoints (unmasked phone, role, stats)
            UserAdmin: {
                type: 'object',
                description:
                    'Full user object visible only to admins — includes real phone and role',
                properties: {
                    id: { type: 'string', example: '664a1f3b2e1a4c001f8d3b22' },
                    phone: {
                        type: 'string',
                        example: '08012345678',
                        description: 'Unmasked — admin only',
                    },
                    maskedPhone: { type: 'string', example: '08***5678' },
                    countryCode: { type: 'string', example: '+234' },
                    role: {
                        type: 'string',
                        enum: ['user', 'admin', 'superadmin'],
                        example: 'user',
                    },
                    referralCode: { type: 'string', example: 'AFM9VC' },
                    vipLevel: { type: 'integer', example: 0 },
                    balance: { type: 'number', example: 12.55 },
                    totalEarnings: { type: 'number', example: 5.3 },
                    todayEarnings: { type: 'number', example: 0.55 },
                    yesterdayEarnings: { type: 'number', example: 0.55 },
                    isActive: { type: 'boolean', example: true },
                    idVerified: { type: 'boolean', example: false },
                    realName: { type: 'string', example: null, nullable: true },
                    telegramJoined: { type: 'boolean', example: false },
                    lastLogin: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    lastCheckin: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    checkinStreak: { type: 'integer', example: 3 },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── Product ──────────────────────────────────────────────
            Product: {
                type: 'object',
                properties: {
                    _id: {
                        type: 'string',
                        example: '664a1f3b2e1a4c001f8d3b01',
                    },
                    name: { type: 'string', example: 'Helia NXT Bifacial' },
                    image: {
                        type: 'string',
                        example: 'https://cdn.jaksonsolar.org/helia.png',
                        nullable: true,
                    },
                    amount: {
                        type: 'number',
                        example: 7.0,
                        description: 'Investment cost in USD',
                    },
                    cycleDays: {
                        type: 'integer',
                        example: 35,
                        description: 'Duration of the investment in days',
                    },
                    dailyIncome: {
                        type: 'number',
                        example: 0.4,
                        description: 'Daily earnings in USD',
                    },
                    maxUnits: {
                        type: 'integer',
                        example: 3,
                        description: 'Max units a single user can buy',
                    },
                    availableUnits: {
                        type: 'integer',
                        example: 97,
                        description: 'Units still available for purchase',
                    },
                    isFree: { type: 'boolean', example: false },
                    isActive: { type: 'boolean', example: true },
                    isSoldOut: {
                        type: 'boolean',
                        example: false,
                        description: 'Virtual: true when availableUnits = 0',
                    },
                    totalReturn: {
                        type: 'number',
                        example: 14.0,
                        description: 'Virtual: dailyIncome × cycleDays',
                    },
                    sortOrder: { type: 'integer', example: 1 },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── User Investment ──────────────────────────────────────
            UserInvestment: {
                type: 'object',
                properties: {
                    _id: {
                        type: 'string',
                        example: '664a2a1b2e1a4c001f8d4c10',
                    },
                    user: {
                        type: 'string',
                        example: '664a1f3b2e1a4c001f8d3b22',
                    },
                    product: { $ref: '#/components/schemas/Product' },
                    productSnapshot: {
                        type: 'object',
                        properties: {
                            name: {
                                type: 'string',
                                example: 'Helia NXT Bifacial',
                            },
                            amount: { type: 'number', example: 7.0 },
                            cycleDays: { type: 'integer', example: 35 },
                            dailyIncome: { type: 'number', example: 0.4 },
                        },
                    },
                    investmentAmount: { type: 'number', example: 7.0 },
                    dailyIncome: { type: 'number', example: 0.4 },
                    startDate: { type: 'string', format: 'date-time' },
                    expirationDate: { type: 'string', format: 'date-time' },
                    status: {
                        type: 'string',
                        enum: ['in_progress', 'completed', 'cancelled'],
                        example: 'in_progress',
                    },
                    totalEarned: { type: 'number', example: 1.2 },
                    daysElapsed: { type: 'integer', example: 3 },
                    lastIncomeDate: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── Deposit ──────────────────────────────────────────────
            Deposit: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: '664a3c002e1a4c001f8d5d20' },
                    amountUSD: { type: 'number', example: 100.0 },
                    amountNGN: { type: 'number', example: 136500.0 },
                    exchangeRate: { type: 'number', example: 1365 },
                    method: { type: 'string', example: 'bank' },
                    bankName: { type: 'string', example: 'OTPay' },
                    accountNumber: { type: 'string', example: '0123456789' },
                    accountName: { type: 'string', example: 'Jakson Solar' },
                    status: {
                        type: 'string',
                        enum: ['pending', 'approved', 'rejected', 'expired'],
                        example: 'pending',
                    },
                    approvedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    rejectedReason: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── Withdrawal ───────────────────────────────────────────
            Withdrawal: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: '664a4e002e1a4c001f8d6e30' },
                    amountUSD: {
                        type: 'number',
                        example: 50.0,
                        description: 'Gross withdrawal amount',
                    },
                    feePercent: {
                        type: 'integer',
                        example: 10,
                        description: '10% (< $500) or 20% (≥ $500)',
                    },
                    feeAmountUSD: {
                        type: 'number',
                        example: 5.0,
                        description: 'Fee deducted',
                    },
                    netAmountUSD: {
                        type: 'number',
                        example: 45.0,
                        description: 'Amount received after fee',
                    },
                    netAmountNGN: {
                        type: 'number',
                        example: 61425,
                        description: 'Net amount in Naira',
                    },
                    bankName: { type: 'string', example: 'GTBANK PLC' },
                    accountNumber: { type: 'string', example: '0123456789' },
                    status: {
                        type: 'string',
                        enum: [
                            'pending',
                            'processing',
                            'completed',
                            'rejected',
                        ],
                        example: 'pending',
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── BankAccount ──────────────────────────────────────────
            BankAccount: {
                type: 'object',
                properties: {
                    _id: {
                        type: 'string',
                        example: '664a5f002e1a4c001f8d7f40',
                    },
                    bankName: { type: 'string', example: 'GTBANK PLC' },
                    accountName: { type: 'string', example: 'John Doe' },
                    accountNumber: { type: 'string', example: '0123456789' },
                    isDefault: { type: 'boolean', example: true },
                    isVerified: { type: 'boolean', example: false },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── Transaction ──────────────────────────────────────────
            Transaction: {
                type: 'object',
                properties: {
                    _id: {
                        type: 'string',
                        example: '664a6a002e1a4c001f8d8a50',
                    },
                    type: {
                        type: 'string',
                        enum: ['in', 'out'],
                        example: 'in',
                    },
                    category: {
                        type: 'string',
                        enum: [
                            'deposit',
                            'withdrawal',
                            'investment',
                            'daily_income',
                            'referral_bonus',
                            'reward_code',
                            'daily_checkin',
                            'refund',
                        ],
                        example: 'daily_income',
                    },
                    amountUSD: { type: 'number', example: 0.55 },
                    balanceBefore: { type: 'number', example: 12.0 },
                    balanceAfter: { type: 'number', example: 12.55 },
                    description: {
                        type: 'string',
                        example: 'Daily income from Free Product',
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },

            // ── Team Stats ───────────────────────────────────────────
            TeamStats: {
                type: 'object',
                properties: {
                    inviteLink: {
                        type: 'string',
                        example: 'https://jaksonsolar.org/register?c=AFM9VC',
                    },
                    referralCode: { type: 'string', example: 'AFM9VC' },
                    totalEarnings: { type: 'number', example: 5.3 },
                    todayEarnings: { type: 'number', example: 0.55 },
                    yesterdayEarnings: { type: 'number', example: 0.55 },
                    team: {
                        type: 'object',
                        properties: {
                            tier1: {
                                type: 'object',
                                properties: {
                                    count: { type: 'integer', example: 4 },
                                    commission: {
                                        type: 'string',
                                        example: '8%',
                                    },
                                },
                            },
                            tier2: {
                                type: 'object',
                                properties: {
                                    count: { type: 'integer', example: 9 },
                                    commission: {
                                        type: 'string',
                                        example: '3%',
                                    },
                                },
                            },
                            tier3: {
                                type: 'object',
                                properties: {
                                    count: { type: 'integer', example: 2 },
                                    commission: {
                                        type: 'string',
                                        example: '1%',
                                    },
                                },
                            },
                            totalPeople: { type: 'integer', example: 15 },
                        },
                    },
                },
            },
        },

        // ─── Reusable Responses ───────────────────────────────────
        responses: {
            Unauthorized: {
                description: '401 – Token missing or invalid',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ErrorResponse' },
                        example: {
                            success: false,
                            message: 'Not authorized, please log in',
                        },
                    },
                },
            },
            Forbidden: {
                description:
                    '403 – Access denied (account suspended or not admin)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ErrorResponse' },
                        example: {
                            success: false,
                            message: 'Admin access required',
                        },
                    },
                },
            },
            NotFound: {
                description: '404 – Resource not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ErrorResponse' },
                        example: {
                            success: false,
                            message: 'Deposit not found',
                        },
                    },
                },
            },
            BadRequest: {
                description: '400 – Validation or business logic error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ErrorResponse' },
                        example: {
                            success: false,
                            message: 'Insufficient balance',
                        },
                    },
                },
            },
            TooManyRequests: {
                description: '429 – Rate limit exceeded',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ErrorResponse' },
                        example: {
                            success: false,
                            message:
                                'Too many requests, please try again later.',
                        },
                    },
                },
            },
        },

        // ─── Reusable Parameters ─────────────────────────────────
        parameters: {
            PageParam: {
                name: 'page',
                in: 'query',
                schema: { type: 'integer', default: 1 },
                description: 'Page number (starts at 1)',
            },
            LimitParam: {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', default: 20, maximum: 100 },
                description: 'Results per page (max 100)',
            },
        },
    },

    // ─── Tags (groups in UI) ─────────────────────────────────────
    tags: [
        {
            name: 'Auth',
            description: 'Registration, login, and password management',
        },
        {
            name: 'Invest',
            description: 'Solar products and investment management',
        },
        { name: 'Deposit', description: 'Wallet top-up via bank transfer' },
        {
            name: 'Withdraw',
            description: 'Cash-out funds to a bound bank account',
        },
        {
            name: 'Wallet',
            description: 'Balance, funding history, and transactions',
        },
        {
            name: 'Bank',
            description: 'Bind and manage withdrawal bank accounts',
        },
        {
            name: 'Team',
            description: '3-tier referral system and commission tracking',
        },
        { name: 'Rewards', description: 'Bonus codes and daily check-in' },
        {
            name: 'Admin',
            description:
                '🔒 Admin & Superadmin routes. Covers: dashboard stats, product CRUD, ' +
                'full user management (list, view, suspend, reactivate, impersonate), ' +
                'direct wallet credit/deduct, role assignment (superadmin only), ' +
                'deposit & withdrawal approval, and app settings.',
        },
        { name: 'Health', description: 'Server status' },
    ],

    // ═══════════════════════════════════════════════════════════
    // PATHS
    // ═══════════════════════════════════════════════════════════
    paths: {
        // ──────────────────────────────────────────────────────────
        // HEALTH
        // ──────────────────────────────────────────────────────────
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'API health check',
                description:
                    'Returns a simple alive response. Useful for uptime monitors.',
                responses: {
                    200: {
                        description: 'Server is running',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Jakson Solar API is running 🌞',
                                },
                            },
                        },
                    },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // AUTH
        // ──────────────────────────────────────────────────────────

        // ──────────────────────────────────────────────────────────
        // CAPTCHA
        // ──────────────────────────────────────────────────────────
        '/auth/captcha': {
            get: {
                tags: ['Auth'],
                summary: 'Generate a new 4-digit captcha image',
                description: `
Returns a fresh captcha with a unique \`captchaId\` and an SVG image as a base64 data URI.

**Client flow:**
1. Call this endpoint when the login or register page loads (and on refresh).
2. Render the image: \`<img src={image} /\>\`
3. User reads the 4 digits and types them in the input field.
4. Send \`captchaId\` + \`captchaAnswer\` with the login/register request.

**Rules:**
- Each captcha is **one-shot** — it is deleted after the first validation attempt (pass or fail).
- Captchas expire after **5 minutes**.
- The frontend should call this again after a failed login/register to get a new one.
        `,
                responses: {
                    200: {
                        description: 'Captcha generated',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Captcha generated',
                                    captchaId:
                                        'a3f2c1d4-e5b6-7890-abcd-ef1234567890',
                                    image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucy...',
                                },
                            },
                        },
                    },
                },
            },
        },

        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user',
                description: `
Creates a new user account.
- Phone must be unique.
- If \`referralCode\` is provided it must match an existing user's code.
- A unique 8-character \`referralCode\` is auto-generated for the new user.
- Returns a JWT token valid for **7 days**.
        `,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'phone',
                                    'password',
                                    'captchaId',
                                    'captchaAnswer',
                                    'securityQuestionId',
                                    'securityAnswer',
                                ],
                                properties: {
                                    phone: {
                                        type: 'string',
                                        example: '08012345678',
                                        description:
                                            'Phone number without country code',
                                    },
                                    password: {
                                        type: 'string',
                                        example: 'Secret123',
                                        description: 'Minimum 6 characters',
                                    },
                                    countryCode: {
                                        type: 'string',
                                        example: '+234',
                                        description:
                                            'Defaults to +234 (Nigeria)',
                                    },
                                    referralCode: {
                                        type: 'string',
                                        example: 'AFM9VC',
                                        description:
                                            "Optional – referrer's code",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Registration successful',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Registration successful',
                                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    user: {
                                        id: '664a1f3b2e1a4c001f8d3b22',
                                        phone: '08***5678',
                                        referralCode: 'XK29PL',
                                        vipLevel: 0,
                                        balance: 0,
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description:
                            'Phone already registered or invalid referral code',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message: 'Phone number already registered',
                                },
                            },
                        },
                    },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },

        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login with phone and password',
                description: `
Authenticates a user and returns a JWT token.
- **Captcha** is handled client-side and validated before hitting this endpoint.
- Account must be active (not suspended).
- Updates \`lastLogin\` timestamp on success.
        `,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'phone',
                                    'password',
                                    'captchaId',
                                    'captchaAnswer',
                                    'securityQuestionId',
                                    'securityAnswer',
                                ],
                                properties: {
                                    phone: {
                                        type: 'string',
                                        example: '08012345678',
                                    },
                                    password: {
                                        type: 'string',
                                        example: 'Secret123',
                                    },
                                    captchaId: {
                                        type: 'string',
                                        example:
                                            'a3f2c1d4-e5b6-7890-abcd-ef1234567890',
                                        description:
                                            'ID received from GET /auth/captcha',
                                    },
                                    captchaAnswer: {
                                        type: 'string',
                                        example: '8661',
                                        description:
                                            '4 digits the user reads from the captcha image',
                                    },
                                    securityQuestionId: {
                                        type: 'integer',
                                        example: 1,
                                        description:
                                            'Question id from GET /auth/security-questions',
                                    },
                                    securityAnswer: {
                                        type: 'string',
                                        example: 'Johnson',
                                        description:
                                            'Answer to the chosen security question (case-insensitive)',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Login successful',
                                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    user: {
                                        id: '664a1f3b2e1a4c001f8d3b22',
                                        phone: '08***5678',
                                        referralCode: 'AFM9VC',
                                        vipLevel: 0,
                                        balance: 12.55,
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid or expired captcha',
                        content: {
                            'application/json': {
                                examples: {
                                    expiredCaptcha: {
                                        value: {
                                            success: false,
                                            message:
                                                'Captcha expired or not found. Please refresh.',
                                        },
                                    },
                                    wrongCaptcha: {
                                        value: {
                                            success: false,
                                            message:
                                                'Incorrect captcha. Please try again.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Wrong phone or password',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message: 'Invalid phone or password',
                                },
                            },
                        },
                    },
                    403: {
                        description: 'Account suspended',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'Account suspended. Contact support.',
                                },
                            },
                        },
                    },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },

        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get current user profile',
                description:
                    'Returns the full profile of the currently authenticated user. No passwords are ever returned.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'User profile',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    user: {
                                        id: '664a1f3b2e1a4c001f8d3b22',
                                        phone: '90***2820',
                                        referralCode: 'AFM9VC',
                                        vipLevel: 0,
                                        balance: 12.55,
                                        totalEarnings: 5.3,
                                        todayEarnings: 0.55,
                                        yesterdayEarnings: 0.55,
                                        realName: null,
                                        idVerified: false,
                                        telegramJoined: false,
                                        lastCheckin: '2026-05-14T09:27:34.000Z',
                                        checkinStreak: 3,
                                        createdAt: '2026-05-01T08:00:00.000Z',
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/auth/change-password': {
            put: {
                tags: ['Auth'],
                summary: 'Change login password',
                description:
                    'Verifies the current password before setting a new one. Both passwords must be provided.',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['currentPassword', 'newPassword'],
                                properties: {
                                    currentPassword: {
                                        type: 'string',
                                        example: 'OldPass123',
                                    },
                                    newPassword: {
                                        type: 'string',
                                        example: 'NewPass456',
                                        description: 'Minimum 6 characters',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Password changed',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Password changed successfully',
                                },
                            },
                        },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/auth/withdraw-password': {
            put: {
                tags: ['Auth'],
                summary: 'Set or change the 6-digit withdrawal password',
                description: `
Used for the first-time setup and subsequent changes of the **6-digit** withdrawal PIN.
Requires the user's **login password** for verification.
This PIN is required every time the user submits a withdrawal request.
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'loginPassword',
                                    'newWithdrawPassword',
                                ],
                                properties: {
                                    loginPassword: {
                                        type: 'string',
                                        example: 'Secret123',
                                        description:
                                            'Current login password for verification',
                                    },
                                    newWithdrawPassword: {
                                        type: 'string',
                                        example: '123456',
                                        description: 'Exactly 6 digits',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Withdrawal password set',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Withdrawal password set successfully',
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Not exactly 6 digits',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'Withdrawal password must be exactly 6 digits',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // INVEST
        // ──────────────────────────────────────────────────────────
        '/invest/products': {
            get: {
                tags: ['Invest'],
                summary: 'List all investment products',
                description: `
Returns all **active** solar panel investment products sorted by \`sortOrder\` then \`amount\`.
- \`isSoldOut\` is \`true\` when \`availableUnits === 0\` — the UI should show a "Sold out" badge.
- \`isFree\` marks the free starter product (amount = $0).
- \`totalReturn\` = \`dailyIncome × cycleDays\` (virtual field).
        `,
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Product list',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    products: [
                                        {
                                            _id: '664a1f3b2e1a4c001f8d3b01',
                                            name: 'Free Product',
                                            amount: 0,
                                            cycleDays: 3,
                                            dailyIncome: 0.55,
                                            maxUnits: 1,
                                            availableUnits: 9999,
                                            isFree: true,
                                            isSoldOut: false,
                                            totalReturn: 1.65,
                                        },
                                        {
                                            _id: '664a1f3b2e1a4c001f8d3b02',
                                            name: 'Helia NXT Bifacial',
                                            amount: 7,
                                            cycleDays: 35,
                                            dailyIncome: 0.4,
                                            maxUnits: 3,
                                            availableUnits: 97,
                                            isFree: false,
                                            isSoldOut: false,
                                            totalReturn: 14.0,
                                        },
                                        {
                                            _id: '664a1f3b2e1a4c001f8d3b03',
                                            name: 'Helia Monofacial',
                                            amount: 12,
                                            cycleDays: 40,
                                            dailyIncome: 0.62,
                                            maxUnits: 3,
                                            availableUnits: 0,
                                            isFree: false,
                                            isSoldOut: true,
                                            totalReturn: 24.8,
                                        },
                                        {
                                            _id: '664a1f3b2e1a4c001f8d3b07',
                                            name: 'Polycrystalline PV',
                                            amount: 500,
                                            cycleDays: 40,
                                            dailyIncome: 22.8,
                                            maxUnits: 2,
                                            availableUnits: 0,
                                            isFree: false,
                                            isSoldOut: true,
                                            totalReturn: 912.0,
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/invest/buy/{productId}': {
            post: {
                tags: ['Invest'],
                summary: 'Purchase an investment product',
                description: `
Deducts \`product.amount\` from the user's wallet and creates an active investment record.
**Rules enforced:**
- Product must be active and not sold out.
- User cannot exceed \`product.maxUnits\` concurrent active units of the same product.
- User must have enough balance (free product is exempt).
- A transaction record (type: \`out\`, category: \`investment\`) is created.
- \`availableUnits\` is decremented (except for the free product).
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'productId',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a1f3b2e1a4c001f8d3b02',
                        description: 'MongoDB ObjectId of the product',
                    },
                ],
                responses: {
                    201: {
                        description: 'Investment created',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Investment successful',
                                    investment: {
                                        _id: '664a2a1b2e1a4c001f8d4c10',
                                        productSnapshot: {
                                            name: 'Helia NXT Bifacial',
                                            amount: 7,
                                            cycleDays: 35,
                                            dailyIncome: 0.4,
                                        },
                                        investmentAmount: 7,
                                        dailyIncome: 0.4,
                                        startDate: '2026-05-14T09:27:34.000Z',
                                        expirationDate:
                                            '2026-06-18T09:27:34.000Z',
                                        status: 'in_progress',
                                        totalEarned: 0,
                                        daysElapsed: 0,
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Business rule violation',
                        content: {
                            'application/json': {
                                examples: {
                                    soldOut: {
                                        value: {
                                            success: false,
                                            message: 'This product is sold out',
                                        },
                                    },
                                    maxUnits: {
                                        value: {
                                            success: false,
                                            message:
                                                'You can only purchase 3 unit(s) of this product',
                                        },
                                    },
                                    noBalance: {
                                        value: {
                                            success: false,
                                            message:
                                                'Insufficient balance. Please recharge your account.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/invest/my': {
            get: {
                tags: ['Invest'],
                summary: 'Get my investment records',
                description:
                    'Returns a paginated list of all investments (active and completed) for the authenticated user, newest first.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'Investment list',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    investments: [
                                        {
                                            _id: '664a2a1b2e1a4c001f8d4c10',
                                            productSnapshot: {
                                                name: 'Free Product',
                                                amount: 0,
                                                cycleDays: 3,
                                                dailyIncome: 0.55,
                                            },
                                            investmentAmount: 0,
                                            dailyIncome: 0.55,
                                            startDate:
                                                '2026-05-14T09:27:34.000Z',
                                            expirationDate:
                                                '2026-05-17T09:27:34.000Z',
                                            status: 'in_progress',
                                            totalEarned: 0.55,
                                            daysElapsed: 1,
                                        },
                                    ],
                                    pagination: {
                                        total: 1,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // DEPOSIT
        // ──────────────────────────────────────────────────────────
        '/deposit': {
            post: {
                tags: ['Deposit'],
                summary: 'Initiate a bank deposit (recharge)',
                description: `
Creates a pending deposit and returns the **payment bank account details** the user should transfer to.
**Important:** A new bank account number is assigned per deposit — users must NOT save the account number for reuse.
Minimum: **$5.00**. The NGN equivalent is calculated using the live \`usd_to_ngn_rate\` from AppSettings.
An admin must approve the deposit before the balance is credited.
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['amountUSD'],
                                properties: {
                                    amountUSD: {
                                        type: 'number',
                                        example: 100,
                                        description:
                                            'Amount in USD (minimum $5.00)',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description:
                            'Deposit initiated — instruct user to complete the bank transfer',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Deposit initiated. Please complete the bank transfer.',
                                    deposit: {
                                        id: '664a3c002e1a4c001f8d5d20',
                                        amountUSD: 100,
                                        amountNGN: 136500,
                                        exchangeRate: 1365,
                                        bankName: 'OTPay',
                                        accountNumber: '0123456789',
                                        accountName: 'Jakson Solar',
                                        status: 'pending',
                                        createdAt: '2026-05-14T09:29:42.000Z',
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Below minimum amount',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message: 'Minimum deposit amount is $5.00',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/deposit/log': {
            get: {
                tags: ['Deposit'],
                summary: 'Get deposit history',
                description:
                    "Paginated list of the user's past deposit requests. Bank account numbers are hidden from this response.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'Deposit log',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    deposits: [
                                        {
                                            _id: '664a3c002e1a4c001f8d5d20',
                                            method: 'bank',
                                            amountUSD: 100,
                                            amountNGN: 136500,
                                            exchangeRate: 1365,
                                            status: 'pending',
                                            createdAt:
                                                '2026-05-14T09:29:42.000Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 1,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // WITHDRAW
        // ──────────────────────────────────────────────────────────
        '/withdraw': {
            post: {
                tags: ['Withdraw'],
                summary: 'Submit a withdrawal request',
                description: `
Withdraws funds to the user's bound bank account.
**Rules enforced:**
- User must have set a **6-digit withdrawal password**.
- A **default bank account** must be bound.
- Only **one withdrawal per calendar day**.
- Minimum **$2.00**.
- Fee: **10%** (< $500) | **20%** (≥ $500).
- Balance is deducted immediately; a refund is issued if admin rejects.
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['amountUSD', 'withdrawPassword'],
                                properties: {
                                    amountUSD: {
                                        type: 'number',
                                        example: 50,
                                        description:
                                            'USD amount to withdraw (min $2.00)',
                                    },
                                    withdrawPassword: {
                                        type: 'string',
                                        example: '123456',
                                        description: '6-digit withdrawal PIN',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Withdrawal submitted',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Withdrawal request submitted successfully',
                                    withdrawal: {
                                        id: '664a4e002e1a4c001f8d6e30',
                                        amountUSD: 50,
                                        feePercent: 10,
                                        feeAmountUSD: 5,
                                        netAmountUSD: 45,
                                        netAmountNGN: 61425,
                                        bankName: 'GTBANK PLC',
                                        accountNumber: '0123456789',
                                        status: 'pending',
                                        createdAt: '2026-05-14T10:00:00.000Z',
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Business rule violation',
                        content: {
                            'application/json': {
                                examples: {
                                    wrongPin: {
                                        value: {
                                            success: false,
                                            message:
                                                'Incorrect withdrawal password',
                                        },
                                    },
                                    noBank: {
                                        value: {
                                            success: false,
                                            message:
                                                'Please bind a bank account first',
                                        },
                                    },
                                    dailyLimit: {
                                        value: {
                                            success: false,
                                            message:
                                                'You can only withdraw once per day',
                                        },
                                    },
                                    noBalance: {
                                        value: {
                                            success: false,
                                            message: 'Insufficient balance',
                                        },
                                    },
                                    belowMin: {
                                        value: {
                                            success: false,
                                            message:
                                                'Minimum withdrawal amount is $2.00',
                                        },
                                    },
                                    noPinSet: {
                                        value: {
                                            success: false,
                                            message:
                                                'Please set your withdrawal password first',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/withdraw/log': {
            get: {
                tags: ['Withdraw'],
                summary: 'Get withdrawal history',
                description:
                    "Paginated list of all the user's past withdrawal requests including fee breakdown.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'Withdrawal log',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    withdrawals: [
                                        {
                                            _id: '664a4e002e1a4c001f8d6e30',
                                            amountUSD: 50,
                                            feePercent: 10,
                                            feeAmountUSD: 5,
                                            netAmountUSD: 45,
                                            netAmountNGN: 61425,
                                            status: 'pending',
                                            createdAt:
                                                '2026-05-14T10:00:00.000Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 1,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // WALLET
        // ──────────────────────────────────────────────────────────
        '/wallet/balance': {
            get: {
                tags: ['Wallet'],
                summary: 'Get wallet balance and earnings summary',
                description:
                    'Returns the current USD balance plus earnings breakdown (today, yesterday, all-time). Earnings reset daily at midnight via cron.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Balance data',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    balance: 12.55,
                                    totalEarnings: 5.3,
                                    todayEarnings: 0.55,
                                    yesterdayEarnings: 0.55,
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/wallet/transactions': {
            get: {
                tags: ['Wallet'],
                summary: 'Get funding / transaction history',
                description: `
Paginated list of all money movements (the "Funding details" screen).
Filter by \`type\` to get the **In** or **Out** tab:
- \`type=in\`  → deposits, daily income, referral bonuses, reward codes, refunds
- \`type=out\` → investments, withdrawals
- _(no type)_ → all transactions
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'type',
                        in: 'query',
                        schema: { type: 'string', enum: ['in', 'out'] },
                        description: 'Filter by direction. Omit for all.',
                    },
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'Transaction list',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    transactions: [
                                        {
                                            _id: '664a6a002e1a4c001f8d8a50',
                                            type: 'out',
                                            category: 'investment',
                                            amountUSD: 7.0,
                                            balanceBefore: 19.55,
                                            balanceAfter: 12.55,
                                            description:
                                                'Invested in Helia NXT Bifacial',
                                            createdAt:
                                                '2026-05-14T09:27:34.000Z',
                                        },
                                        {
                                            _id: '664a6b002e1a4c001f8d8b51',
                                            type: 'in',
                                            category: 'daily_income',
                                            amountUSD: 0.55,
                                            balanceBefore: 12.55,
                                            balanceAfter: 13.1,
                                            description:
                                                'Daily income from Free Product',
                                            createdAt:
                                                '2026-05-15T00:00:01.000Z',
                                        },
                                        {
                                            _id: '664a6c002e1a4c001f8d8c52',
                                            type: 'in',
                                            category: 'deposit',
                                            amountUSD: 100.0,
                                            balanceBefore: 0.0,
                                            balanceAfter: 100.0,
                                            description:
                                                'Bank deposit approved',
                                            createdAt:
                                                '2026-05-14T10:30:00.000Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 3,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // BANK
        // ──────────────────────────────────────────────────────────
        '/bank/list': {
            get: {
                tags: ['Bank'],
                summary: 'Get list of supported Nigerian banks',
                description:
                    'Returns the full list of Nigerian banks available for withdrawal account binding. Used to populate the "Select a bank" dropdown.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Supported banks',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    banks: [
                                        'ACCESS BANK',
                                        'ECOBANK',
                                        'EYOWO MFB',
                                        'FCMB BANK',
                                        'FIDELITY BANK',
                                        'FIRST BANK',
                                        'GTBANK PLC',
                                        'GLOBUS BANK',
                                        'HERITAGE BANK',
                                        'JAIZ BANK',
                                        'KEYSTONE BANK',
                                        'KUDA BANK',
                                        'MONIEPOINT',
                                        'OPAY',
                                        'PAGA',
                                        'PROVIDUS BANK',
                                        'STANBIC IBTC BANK',
                                        'STERLING BANK',
                                        'SUNTRUST BANK',
                                        'TAJ BANK',
                                        'TITAN TRUST BANK',
                                        'UBA BANK',
                                        'UNION BANK',
                                        'UNITY BANK',
                                        'WEMA BANK',
                                        'ZENITH BANK',
                                    ],
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/bank/accounts': {
            get: {
                tags: ['Bank'],
                summary: "Get user's bound withdrawal accounts",
                description:
                    "Returns all bank accounts linked to the user's withdrawal profile. Typically one active default account.",
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Bank accounts',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    accounts: [
                                        {
                                            _id: '664a5f002e1a4c001f8d7f40',
                                            bankName: 'GTBANK PLC',
                                            accountName: 'John Doe',
                                            accountNumber: '0123456789',
                                            isDefault: true,
                                            isVerified: false,
                                            createdAt:
                                                '2026-05-14T10:27:00.000Z',
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/bank/bind': {
            post: {
                tags: ['Bank'],
                summary: 'Bind a bank account for withdrawals',
                description: `
Links a Nigerian bank account to the user for withdrawal purposes.
- The new account becomes the **default** (previous default is unset).
- \`bankName\` must match one of the values from \`GET /bank/list\` exactly.
- Ensure this is the user's **real-name verified** account or withdrawals will fail.
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'bankName',
                                    'accountName',
                                    'accountNumber',
                                ],
                                properties: {
                                    bankName: {
                                        type: 'string',
                                        example: 'GTBANK PLC',
                                        description:
                                            'Must match a value from GET /bank/list',
                                    },
                                    accountName: {
                                        type: 'string',
                                        example: 'John Doe',
                                        description:
                                            'Full name as registered with the bank',
                                    },
                                    accountNumber: {
                                        type: 'string',
                                        example: '0123456789',
                                        description:
                                            '10-digit NUBAN account number',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Bank account bound',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Bank account bound successfully',
                                    account: {
                                        _id: '664a5f002e1a4c001f8d7f40',
                                        bankName: 'GTBANK PLC',
                                        accountName: 'John Doe',
                                        accountNumber: '0123456789',
                                        isDefault: true,
                                        isVerified: false,
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Missing fields or unsupported bank',
                        content: {
                            'application/json': {
                                examples: {
                                    missingFields: {
                                        value: {
                                            success: false,
                                            message:
                                                'Bank name, account name and account number are required',
                                        },
                                    },
                                    badBank: {
                                        value: {
                                            success: false,
                                            message:
                                                'Unsupported bank. Please select from the list.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // TEAM
        // ──────────────────────────────────────────────────────────
        '/team/stats': {
            get: {
                tags: ['Team'],
                summary: 'Get referral team statistics',
                description: `
Returns a summary of the user's referral team across 3 tiers:
| Tier | Commission |
|------|-----------|
| Lv.1 (direct referrals) | **8%** of their daily income |
| Lv.2 | **3%** |
| Lv.3 | **1%** |

Also returns the user's **invite link** and earnings totals.
        `,
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Team stats',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    inviteLink:
                                        'https://jaksonsolar.org/register?c=AFM9VC',
                                    referralCode: 'AFM9VC',
                                    totalEarnings: 5.3,
                                    todayEarnings: 0.55,
                                    yesterdayEarnings: 0.55,
                                    team: {
                                        tier1: { count: 4, commission: '8%' },
                                        tier2: { count: 9, commission: '3%' },
                                        tier3: { count: 2, commission: '1%' },
                                        totalPeople: 15,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/team/members/{tier}': {
            get: {
                tags: ['Team'],
                summary: 'Get members of a specific referral tier',
                description:
                    'Returns paginated list of users in the specified tier (1, 2, or 3). Phone numbers are masked for privacy.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'tier',
                        in: 'path',
                        required: true,
                        schema: { type: 'integer', enum: [1, 2, 3] },
                        example: 1,
                        description:
                            'Referral tier level (1 = direct, 2 = indirect, 3 = deep)',
                    },
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'Tier members',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    tier: 1,
                                    members: [
                                        {
                                            phone: '08***4567',
                                            vipLevel: 0,
                                            joinedAt:
                                                '2026-05-10T07:00:00.000Z',
                                        },
                                        {
                                            phone: '07***8901',
                                            vipLevel: 0,
                                            joinedAt:
                                                '2026-05-12T11:00:00.000Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 4,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid tier',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message: 'Tier must be 1, 2, or 3',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // REWARDS & CHECKIN
        // ──────────────────────────────────────────────────────────
        '/reward/redeem': {
            post: {
                tags: ['Rewards'],
                summary: 'Redeem a bonus/reward code',
                description: `
Validates and applies a promotional bonus code.
**Validation checks (in order):**
1. Code must exist and be active.
2. Code must not be expired (\`expiresAt\`).
3. Code must not have reached its \`maxUses\` limit.
4. The same user cannot redeem the same code twice.

On success, the USD value is immediately credited to the user's balance and a transaction record is created.
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code'],
                                properties: {
                                    code: {
                                        type: 'string',
                                        example: 'SOLAR2026',
                                        description:
                                            'Case-insensitive bonus code',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Code redeemed successfully',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: '$5.00 credited to your account!',
                                    amountCredited: 5,
                                    newBalance: 17.55,
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid or already used code',
                        content: {
                            'application/json': {
                                examples: {
                                    invalid: {
                                        value: {
                                            success: false,
                                            message: 'Invalid reward code',
                                        },
                                    },
                                    expired: {
                                        value: {
                                            success: false,
                                            message: 'Code has expired',
                                        },
                                    },
                                    maxUses: {
                                        value: {
                                            success: false,
                                            message:
                                                'Code has reached max uses',
                                        },
                                    },
                                    alreadyUsed: {
                                        value: {
                                            success: false,
                                            message:
                                                'You have already used this code',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        '/checkin': {
            post: {
                tags: ['Rewards'],
                summary: 'Daily check-in',
                description: `
Awards a small daily reward ($0.01) for checking in.
- Only **one check-in per calendar day** is allowed.
- \`checkinStreak\` increments on each successful check-in.
- Balance, totalEarnings, and a transaction record are updated.
        `,
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Check-in successful',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Check-in successful!',
                                    reward: 0.01,
                                    streak: 4,
                                    newBalance: 12.56,
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Already checked in today',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'You have already checked in today',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // PASSWORD RESET (Security Question flow)
        // ──────────────────────────────────────────────────────────
        '/auth/security-questions': {
            get: {
                tags: ['Auth'],
                summary: 'Get list of security questions',
                description: `
Returns all predefined security questions users can choose from during registration.
Each question has an \`id\` (sent back with the answer) and a \`question\` string.
        `,
                responses: {
                    200: {
                        description: 'Question list',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    questions: [
                                        {
                                            id: 1,
                                            question:
                                                "What is your mother's maiden name?",
                                        },
                                        {
                                            id: 2,
                                            question:
                                                'What was the name of your first pet?',
                                        },
                                        {
                                            id: 3,
                                            question:
                                                'What is the name of the town where you were born?',
                                        },
                                        {
                                            id: 4,
                                            question:
                                                'What was the name of your primary school?',
                                        },
                                        {
                                            id: 5,
                                            question:
                                                "What is your oldest sibling's middle name?",
                                        },
                                        {
                                            id: 6,
                                            question:
                                                'What was the make of your first car?',
                                        },
                                        {
                                            id: 7,
                                            question:
                                                "What is your maternal grandmother's first name?",
                                        },
                                        {
                                            id: 8,
                                            question:
                                                'What was the street you grew up on?',
                                        },
                                        {
                                            id: 9,
                                            question:
                                                'What was your childhood nickname?',
                                        },
                                        {
                                            id: 10,
                                            question:
                                                'What is the name of your favourite childhood friend?',
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },

        '/auth/security-question/{phone}': {
            get: {
                tags: ['Auth'],
                summary: 'Get the security question for a phone number',
                description: `
Used on the **Forgot Password** screen.
The client first asks the user for their phone number, then calls this endpoint to fetch and display the specific question they set during registration.

**Privacy note:** If the phone is not found or has no security question, the response still returns \`200\` with \`question: null\` — never a 404 — to avoid revealing whether a phone is registered.
        `,
                parameters: [
                    {
                        name: 'phone',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '08012345678',
                        description: 'Phone number (without country code)',
                    },
                ],
                responses: {
                    200: {
                        description:
                            'Security question retrieved (or null if not found)',
                        content: {
                            'application/json': {
                                examples: {
                                    found: {
                                        summary: 'Phone found with question',
                                        value: {
                                            success: true,
                                            message: 'Success',
                                            questionId: 1,
                                            question:
                                                "What is your mother's maiden name?",
                                        },
                                    },
                                    notFound: {
                                        summary:
                                            'Phone not found (same response for privacy)',
                                        value: {
                                            success: true,
                                            message:
                                                'If this phone is registered, a security question will be shown.',
                                            question: null,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        '/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Verify security answer → receive a reset token',
                description: `
**Step 2 of the password reset flow** (after fetching the question via \`GET /auth/security-question/:phone\`).

The user submits their phone, the question ID, and their answer.
If the answer matches, a **one-time reset token** is returned (valid for **15 minutes**).

**Security behaviour:**
- The answer check is **case-insensitive** (lowercased before bcrypt comparison).
- On any failure (wrong phone, wrong question, wrong answer), the same generic error is returned — the server never reveals which field was wrong.
- The reset token is one-shot and expires in 15 minutes.
        `,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'phone',
                                    'securityQuestionId',
                                    'securityAnswer',
                                ],
                                properties: {
                                    phone: {
                                        type: 'string',
                                        example: '08012345678',
                                    },
                                    securityQuestionId: {
                                        type: 'integer',
                                        example: 1,
                                        description:
                                            'The id from GET /auth/security-question/:phone',
                                    },
                                    securityAnswer: {
                                        type: 'string',
                                        example: 'Johnson',
                                        description:
                                            'Case-insensitive — user types their answer',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Answer correct — reset token issued',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Answer verified. You may now reset your password.',
                                    resetToken:
                                        'a3f2c1d4-e5b6-7890-abcd-ef1234567890',
                                },
                            },
                        },
                    },
                    401: {
                        description:
                            'Wrong answer (generic — never reveals which field failed)',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'Incorrect answer. Please try again.',
                                },
                            },
                        },
                    },
                },
            },
        },

        '/auth/reset-password': {
            post: {
                tags: ['Auth'],
                summary: 'Set a new password using a reset token',
                description: `
**Step 3 of the password reset flow** (after receiving the \`resetToken\` from \`POST /auth/forgot-password\`).

The user submits the token and their chosen new password.

**Rules:**
- Token must be valid and not expired (15-minute window).
- Token is **deleted immediately** after use (one-shot — cannot be reused).
- New password is hashed by the pre-save hook, same as during registration.
- Minimum 6 characters.
        `,
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['resetToken', 'newPassword'],
                                properties: {
                                    resetToken: {
                                        type: 'string',
                                        example:
                                            'a3f2c1d4-e5b6-7890-abcd-ef1234567890',
                                        description:
                                            'Token from POST /auth/forgot-password',
                                    },
                                    newPassword: {
                                        type: 'string',
                                        example: 'NewSecure789',
                                        description: 'Minimum 6 characters',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Password reset successfully',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Password reset successfully. Please log in with your new password.',
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Validation error',
                        content: {
                            'application/json': {
                                examples: {
                                    missingFields: {
                                        value: {
                                            success: false,
                                            message:
                                                'Reset token and new password are required',
                                        },
                                    },
                                    tooShort: {
                                        value: {
                                            success: false,
                                            message:
                                                'Password must be at least 6 characters',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid or expired token',
                        content: {
                            'application/json': {
                                examples: {
                                    expired: {
                                        value: {
                                            success: false,
                                            message:
                                                'Reset token has expired. Please start over.',
                                        },
                                    },
                                    invalid: {
                                        value: {
                                            success: false,
                                            message:
                                                'Invalid or expired reset token. Please start over.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // ADMIN
        // ──────────────────────────────────────────────────────────

        // ──────────────────────────────────────────────────────────
        // ADMIN – DASHBOARD
        // ──────────────────────────────────────────────────────────
        '/admin/dashboard': {
            get: {
                tags: ['Admin'],
                summary: '🔒 Admin dashboard overview',
                description:
                    'Returns platform-wide stats: users, products, pending actions, and financial totals.',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dashboard stats',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    users: {
                                        total: 320,
                                        active: 315,
                                        suspended: 5,
                                        newToday: 12,
                                    },
                                    products: { total: 10, active: 7 },
                                    finance: {
                                        pendingDeposits: 4,
                                        pendingWithdrawals: 2,
                                        totalDeposited: 48500,
                                        totalWithdrawn: 12200,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // ADMIN – PRODUCT MANAGEMENT
        // ──────────────────────────────────────────────────────────
        '/admin/products': {
            get: {
                tags: ['Admin'],
                summary: '🔒 Get all products (including inactive)',
                description:
                    'Returns every product regardless of active status. Use `?status=active` or `?status=inactive` to filter.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: ['active', 'inactive', 'all'],
                        },
                        description: 'Filter by product status',
                    },
                ],
                responses: {
                    200: {
                        description: 'All products',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    total: 7,
                                    products: [
                                        {
                                            _id: '664a...',
                                            name: 'Free Product',
                                            amount: 0,
                                            cycleDays: 3,
                                            dailyIncome: 0.55,
                                            availableUnits: 9999,
                                            isActive: true,
                                            isSoldOut: false,
                                        },
                                        {
                                            _id: '664b...',
                                            name: 'Helia Monofacial',
                                            amount: 12,
                                            cycleDays: 40,
                                            dailyIncome: 0.62,
                                            availableUnits: 0,
                                            isActive: true,
                                            isSoldOut: true,
                                        },
                                        {
                                            _id: '664c...',
                                            name: 'Old Product',
                                            amount: 50,
                                            cycleDays: 30,
                                            dailyIncome: 2.0,
                                            availableUnits: 0,
                                            isActive: false,
                                            isSoldOut: true,
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
            post: {
                tags: ['Admin'],
                summary: '🔒 Create a new investment product',
                description:
                    'Creates a product immediately visible on the Invest page once `isActive: true`.',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: [
                                    'name',
                                    'amount',
                                    'cycleDays',
                                    'dailyIncome',
                                ],
                                properties: {
                                    name: {
                                        type: 'string',
                                        example: 'TOPCon Elite',
                                        description: 'Product display name',
                                    },
                                    image: {
                                        type: 'string',
                                        example:
                                            'https://cdn.jaksonsolar.org/topcon.png',
                                        description: 'Image URL (optional)',
                                    },
                                    amount: {
                                        type: 'number',
                                        example: 60,
                                        description:
                                            'Investment cost in USD (0 = free)',
                                    },
                                    cycleDays: {
                                        type: 'integer',
                                        example: 40,
                                        description: 'Duration in days',
                                    },
                                    dailyIncome: {
                                        type: 'number',
                                        example: 2.8,
                                        description: 'Daily earnings in USD',
                                    },
                                    maxUnits: {
                                        type: 'integer',
                                        example: 3,
                                        description:
                                            'Max units per user (default 1)',
                                    },
                                    availableUnits: {
                                        type: 'integer',
                                        example: 50,
                                        description: 'Total stock available',
                                    },
                                    isFree: { type: 'boolean', example: false },
                                    sortOrder: {
                                        type: 'integer',
                                        example: 3,
                                        description:
                                            'Display order (lower = first)',
                                    },
                                },
                            },
                            example: {
                                name: 'TOPCon Elite',
                                amount: 60,
                                cycleDays: 40,
                                dailyIncome: 2.8,
                                maxUnits: 3,
                                availableUnits: 50,
                                sortOrder: 3,
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Product created',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Product created successfully',
                                    product: {
                                        _id: '664d...',
                                        name: 'TOPCon Elite',
                                        amount: 60,
                                        cycleDays: 40,
                                        dailyIncome: 2.8,
                                        maxUnits: 3,
                                        availableUnits: 50,
                                        isActive: true,
                                        totalReturn: 112,
                                        isSoldOut: false,
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },

        '/admin/products/{id}': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Update a product',
                description:
                    'Update any field of a product. Only provided fields are changed. Use `isActive: false` to hide without deleting. Use `availableUnits` to restock a sold-out product.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Product MongoDB ObjectId',
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    image: { type: 'string' },
                                    amount: { type: 'number' },
                                    cycleDays: { type: 'integer' },
                                    dailyIncome: { type: 'number' },
                                    maxUnits: { type: 'integer' },
                                    availableUnits: {
                                        type: 'integer',
                                        description:
                                            'Set to restock sold-out products',
                                    },
                                    isActive: {
                                        type: 'boolean',
                                        description:
                                            'false = hidden from users',
                                    },
                                    sortOrder: { type: 'integer' },
                                },
                            },
                            examples: {
                                restock: {
                                    summary: 'Restock a sold-out product',
                                    value: { availableUnits: 50 },
                                },
                                hide: {
                                    summary: 'Hide product from users',
                                    value: { isActive: false },
                                },
                                updatePrice: {
                                    summary: 'Change daily income',
                                    value: { dailyIncome: 3.5 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Product updated',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Product updated successfully',
                                    product: {
                                        _id: '664d...',
                                        name: 'TOPCon Elite',
                                        availableUnits: 50,
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Admin'],
                summary: '🔒 Soft-delete a product',
                description:
                    'Sets `isActive: false` — the product disappears from the user-facing Invest page but is preserved in the database. Use PUT to restore it.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Product deactivated',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Product deactivated successfully',
                                    product: {
                                        _id: '664d...',
                                        isActive: false,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        // ──────────────────────────────────────────────────────────
        // ADMIN – USER MANAGEMENT
        // ──────────────────────────────────────────────────────────
        '/admin/users': {
            get: {
                tags: ['Admin'],
                summary: '🔒 List all users with activity summary',
                description: `
Returns a paginated list of all users. Response uses the **UserAdmin** schema (includes real phone and role).

**Filters (query params):**
| Param | Type | Example | Description |
|-------|------|---------|-------------|
| \`status\` | string | \`active\` / \`suspended\` | Filter by isActive flag |
| \`phone\` | string | \`0801\` | Partial phone number search |
| \`vip\` | integer | \`0\` | Filter by VIP level |
| \`page\` | integer | \`1\` | Page number (default 1) |
| \`limit\` | integer | \`20\` | Results per page (max 100) |
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: ['active', 'suspended'],
                        },
                    },
                    {
                        name: 'phone',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Partial phone match',
                    },
                    {
                        name: 'vip',
                        in: 'query',
                        schema: { type: 'integer' },
                        description: 'Filter by VIP level',
                    },
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'User list',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    users: [
                                        {
                                            id: '664a...',
                                            phone: '08012345678',
                                            maskedPhone: '08***5678',
                                            balance: 12.55,
                                            totalEarnings: 5.3,
                                            isActive: true,
                                            vipLevel: 0,
                                            lastLogin: '2026-05-14T09:00:00Z',
                                            createdAt: '2026-05-01T00:00:00Z',
                                        },
                                        {
                                            id: '664b...',
                                            phone: '07098765432',
                                            maskedPhone: '07***5432',
                                            balance: 0,
                                            totalEarnings: 0,
                                            isActive: false,
                                            vipLevel: 0,
                                            lastLogin: null,
                                            createdAt: '2026-05-03T00:00:00Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 320,
                                        page: 1,
                                        limit: 20,
                                        pages: 16,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },

        '/admin/users/{id}': {
            get: {
                tags: ['Admin'],
                summary: '🔒 Get a single user — full profile + activity',
                description:
                    'Returns the complete user profile with their last 10 records across investments, deposits, withdrawals, and transactions. Also includes computed stats.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        description: 'User MongoDB ObjectId',
                    },
                ],
                responses: {
                    200: {
                        description: 'Full user profile',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    user: {
                                        id: '664a...',
                                        phone: '08012345678',
                                        balance: 12.55,
                                        totalEarnings: 5.3,
                                        isActive: true,
                                        vipLevel: 0,
                                        idVerified: false,
                                        referralCode: 'AFM9VC',
                                        createdAt: '2026-05-01T00:00:00Z',
                                    },
                                    stats: {
                                        totalInvestments: 2,
                                        activeInvestments: 1,
                                        totalDeposited: 100,
                                        totalWithdrawn: 0,
                                        directReferrals: 3,
                                    },
                                    activity: {
                                        investments: [
                                            {
                                                productSnapshot: {
                                                    name: 'Free Product',
                                                },
                                                status: 'in_progress',
                                                dailyIncome: 0.55,
                                            },
                                        ],
                                        deposits: [
                                            {
                                                amountUSD: 100,
                                                status: 'approved',
                                                createdAt:
                                                    '2026-05-14T09:29:42Z',
                                            },
                                        ],
                                        withdrawals: [],
                                        transactions: [
                                            {
                                                type: 'in',
                                                category: 'daily_income',
                                                amountUSD: 0.55,
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/suspend': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Suspend a user',
                description:
                    'Sets `isActive: false`. The user immediately receives a 403 on any API call. They cannot login, invest, deposit, or withdraw until reactivated.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reason: {
                                        type: 'string',
                                        example:
                                            'Suspicious withdrawal activity detected',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'User suspended',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'User 08***5678 has been suspended',
                                    user: { id: '664a...', isActive: false },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Cannot suspend yourself',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message: 'You cannot suspend yourself',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/unsuspend': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Reactivate a suspended user',
                description:
                    'Sets `isActive: true`. The user can immediately log in and perform all actions again.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: {
                        description: 'User reactivated',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'User 08***5678 has been reactivated',
                                    user: { id: '664a...', isActive: true },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/role': {
            put: {
                tags: ['Admin'],
                summary: '🔑 Assign a role to a user (superadmin only)',
                description: `
Promotes or demotes a user's role. Only a **superadmin** can call this endpoint — a regular admin token will receive a 403.

**Available roles:**
| Role | Access |
|------|--------|
| \`user\` | Standard platform user — no admin access |
| \`admin\` | Can manage products, users, deposits, withdrawals, and settings |
| \`superadmin\` | Full access including role assignment and admin management |

**Rules:**
- A superadmin cannot demote themselves (prevents lockout).
- All role changes are logged server-side with the acting superadmin's ID.
- To create the first superadmin, run \`npm run seed\` — it creates a default account on first run.
- Impersonation tokens are **blocked** from this endpoint.
                `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a1f3b2e1a4c001f8d3b22',
                        description: 'MongoDB ObjectId of the target user',
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['role'],
                                properties: {
                                    role: {
                                        type: 'string',
                                        enum: ['user', 'admin', 'superadmin'],
                                        example: 'admin',
                                        description:
                                            'The role to assign to the user',
                                    },
                                },
                            },
                            examples: {
                                promote: {
                                    summary: 'Promote user to admin',
                                    value: { role: 'admin' },
                                },
                                demote: {
                                    summary: 'Demote admin back to user',
                                    value: { role: 'user' },
                                },
                                superadmin: {
                                    summary: 'Promote to superadmin',
                                    value: { role: 'superadmin' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Role updated successfully',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        "Role updated to 'admin' successfully",
                                    user: {
                                        id: '664a1f3b2e1a4c001f8d3b22',
                                        phone: '08***5678',
                                        role: 'admin',
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid role or self-demotion attempt',
                        content: {
                            'application/json': {
                                examples: {
                                    invalidRole: {
                                        summary: 'Invalid role value',
                                        value: {
                                            success: false,
                                            message:
                                                'Role must be one of: user, admin, superadmin',
                                        },
                                    },
                                    selfDemotion: {
                                        summary: 'Trying to demote yourself',
                                        value: {
                                            success: false,
                                            message:
                                                'You cannot demote yourself',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: {
                        description:
                            '403 — Regular admin or impersonation token',
                        content: {
                            'application/json': {
                                examples: {
                                    notSuperadmin: {
                                        summary:
                                            'Logged in as admin, not superadmin',
                                        value: {
                                            success: false,
                                            message:
                                                'Superadmin access required',
                                        },
                                    },
                                    impersonation: {
                                        summary: 'Using an impersonation token',
                                        value: {
                                            success: false,
                                            message:
                                                'Impersonation tokens cannot access admin routes',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/login-as': {
            post: {
                tags: ['Admin'],
                summary: '🔒 Login as a user (impersonation)',
                description: `
Generates a special **impersonation token** that grants admin access to a user's account for support purposes.

**Security rules:**
- Token expires in **2 hours** (shorter than normal tokens).
- Impersonation tokens are **blocked** from all \`/admin/*\` routes to prevent privilege escalation.
- All impersonation events are logged server-side with the admin's ID.
- Use the returned token as a normal Bearer token in the frontend.
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Target user MongoDB ObjectId',
                    },
                ],
                responses: {
                    200: {
                        description: 'Impersonation token issued',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Now logged in as 08***5678. Token valid for 2 hours.',
                                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    isImpersonating: true,
                                    adminId: '664admin...',
                                    targetUser: {
                                        id: '664a...',
                                        phone: '08***5678',
                                        balance: 12.55,
                                        vipLevel: 0,
                                        referralCode: 'AFM9VC',
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/credit': {
            post: {
                tags: ['Admin'],
                summary: '🔒 Credit a user wallet',
                description: `
Directly adds USD to a user's balance. A reason is **mandatory** for audit trail purposes.
A transaction record (type: \`in\`, category: \`refund\`) is automatically created with an \`[ADMIN CREDIT]\` prefix in the description.
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['amountUSD', 'reason'],
                                properties: {
                                    amountUSD: {
                                        type: 'number',
                                        example: 10,
                                        description:
                                            'Amount to credit in USD (must be > 0)',
                                    },
                                    reason: {
                                        type: 'string',
                                        example:
                                            'Compensation for failed deposit on 2026-05-14',
                                        description:
                                            'Required — logged in transaction description',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Wallet credited',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        '$10 credited to 08***5678 successfully',
                                    userId: '664a...',
                                    phone: '08***5678',
                                    amountCredited: 10,
                                    balanceBefore: 12.55,
                                    balanceAfter: 22.55,
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Missing amount or reason',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'A reason is required for manual wallet credit',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/users/{id}/deduct': {
            post: {
                tags: ['Admin'],
                summary: '🔒 Deduct from a user wallet',
                description: `
Directly removes USD from a user's balance. A reason is **mandatory**.
Fails if the user's balance is less than the requested amount.
A transaction record (type: \`out\`, category: \`withdrawal\`) is created with an \`[ADMIN DEDUCT]\` prefix.
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['amountUSD', 'reason'],
                                properties: {
                                    amountUSD: {
                                        type: 'number',
                                        example: 5,
                                        description:
                                            'Amount to deduct in USD (must be > 0)',
                                    },
                                    reason: {
                                        type: 'string',
                                        example:
                                            'Reversal of duplicate deposit credit',
                                        description:
                                            'Required — logged in transaction description',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Wallet deducted',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        '$5 deducted from 08***5678 successfully',
                                    userId: '664a...',
                                    phone: '08***5678',
                                    amountDeducted: 5,
                                    balanceBefore: 22.55,
                                    balanceAfter: 17.55,
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Insufficient balance or missing fields',
                        content: {
                            'application/json': {
                                examples: {
                                    noBalance: {
                                        value: {
                                            success: false,
                                            message:
                                                'Insufficient balance. User only has $2.5000',
                                        },
                                    },
                                    noReason: {
                                        value: {
                                            success: false,
                                            message:
                                                'A reason is required for manual wallet deduction',
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/deposits': {
            get: {
                tags: ['Admin'],
                summary: '🔒 List all deposits (admin)',
                description:
                    'Returns all deposits across all users. Filter by `status` to find pending ones needing review.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: [
                                'pending',
                                'approved',
                                'rejected',
                                'expired',
                            ],
                        },
                        description: 'Filter by deposit status',
                    },
                    { $ref: '#/components/parameters/PageParam' },
                    { $ref: '#/components/parameters/LimitParam' },
                ],
                responses: {
                    200: {
                        description: 'All deposits',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    deposits: [
                                        {
                                            _id: '664a3c002e1a4c001f8d5d20',
                                            user: { phone: '08***5678' },
                                            amountUSD: 100,
                                            amountNGN: 136500,
                                            method: 'bank',
                                            status: 'pending',
                                            createdAt:
                                                '2026-05-14T09:29:42.000Z',
                                        },
                                    ],
                                    pagination: {
                                        total: 1,
                                        page: 1,
                                        limit: 20,
                                        pages: 1,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },

        '/admin/deposits/{id}/approve': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Approve a deposit',
                description: `
Credits the deposit amount to the user\'s balance and marks the deposit as \`approved\`.
A \`deposit\` transaction (type: \`in\`) is recorded.
Can only be applied to deposits with status \`pending\`.
        `,
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a3c002e1a4c001f8d5d20',
                        description: 'Deposit MongoDB ObjectId',
                    },
                ],
                responses: {
                    200: {
                        description: 'Deposit approved and balance credited',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Deposit approved successfully',
                                    deposit: {
                                        status: 'approved',
                                        approvedAt: '2026-05-14T11:00:00.000Z',
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Wrong status',
                        content: {
                            'application/json': {
                                example: {
                                    success: false,
                                    message:
                                        'Cannot approve a deposit with status: approved',
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/deposits/{id}/reject': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Reject a deposit',
                description:
                    "Marks the deposit as `rejected`. The user's balance is **not** affected. A reason should always be provided.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a3c002e1a4c001f8d5d20',
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reason: {
                                        type: 'string',
                                        example:
                                            'Payment not received in our account',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Deposit rejected',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Deposit rejected',
                                    deposit: {
                                        status: 'rejected',
                                        rejectedReason:
                                            'Payment not received in our account',
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/withdraw/{id}/approve': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Approve a withdrawal',
                description:
                    'Marks a withdrawal as `completed`. The balance was already deducted when the request was submitted.',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a4e002e1a4c001f8d6e30',
                    },
                ],
                responses: {
                    200: {
                        description: 'Withdrawal approved',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Withdrawal approved',
                                    withdrawal: {
                                        status: 'completed',
                                        processedAt: '2026-05-14T12:00:00.000Z',
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/withdraw/{id}/reject': {
            put: {
                tags: ['Admin'],
                summary: '🔒 Reject a withdrawal and refund balance',
                description:
                    "Marks the withdrawal as `rejected` and **refunds** the full gross amount back to the user's balance. A `refund` transaction is recorded.",
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: '664a4e002e1a4c001f8d6e30',
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reason: {
                                        type: 'string',
                                        example:
                                            'Invalid bank account details provided',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Withdrawal rejected and refunded',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message:
                                        'Withdrawal rejected and balance refunded',
                                    withdrawal: {
                                        status: 'rejected',
                                        rejectedReason:
                                            'Invalid bank account details provided',
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        '/admin/settings': {
            get: {
                tags: ['Admin'],
                summary: '🔒 Get all app settings',
                description:
                    'Returns all key-value settings (exchange rate, payment bank, withdrawal limits, etc.).',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'App settings',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Success',
                                    settings: [
                                        {
                                            key: 'usd_to_ngn_rate',
                                            value: 1365,
                                            description:
                                                'USD to NGN exchange rate',
                                        },
                                        {
                                            key: 'min_deposit',
                                            value: 5,
                                            description:
                                                'Minimum deposit in USD',
                                        },
                                        {
                                            key: 'min_withdrawal',
                                            value: 2,
                                            description:
                                                'Minimum withdrawal in USD',
                                        },
                                        {
                                            key: 'withdrawal_fee_low',
                                            value: 10,
                                            description: 'Fee % below $500',
                                        },
                                        {
                                            key: 'withdrawal_fee_high',
                                            value: 20,
                                            description: 'Fee % at $500+',
                                        },
                                        {
                                            key: 'payment_bank_account',
                                            value: {
                                                bankName: 'OTPay',
                                                accountNumber: '0123456789',
                                                accountName: 'Jakson Solar',
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
            put: {
                tags: ['Admin'],
                summary: '🔒 Update an app setting',
                description: `
Update any key-value setting. Common keys:
| Key | Type | Example |
|-----|------|---------|
| \`usd_to_ngn_rate\` | number | \`1400\` |
| \`payment_bank_account\` | object | \`{"bankName":"OTPay","accountNumber":"xxx","accountName":"Jakson Solar"}\` |
| \`min_deposit\` | number | \`10\` |
        `,
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['key', 'value'],
                                properties: {
                                    key: {
                                        type: 'string',
                                        example: 'usd_to_ngn_rate',
                                    },
                                    value: {
                                        example: 1400,
                                        description:
                                            'Any JSON-compatible value',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Setting updated',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    message: 'Setting updated',
                                    setting: {
                                        key: 'usd_to_ngn_rate',
                                        value: 1400,
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
    },
}

module.exports = swaggerDefinition
