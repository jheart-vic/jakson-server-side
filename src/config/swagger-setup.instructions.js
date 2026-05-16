/**
 * ─────────────────────────────────────────────────────────────
 *  HOW TO ADD SWAGGER TO server.js
 *  Add these lines in the exact positions shown below.
 * ─────────────────────────────────────────────────────────────
 *
 *  STEP 1 – Add these two requires at the TOP of server.js
 *           (after the existing requires)
 */

const swaggerUi         = require('swagger-ui-express');
const swaggerDefinition = require('./config/swagger');

/**
 *  STEP 2 – Add this ONE line after the line  app.use('/api', routes);
 *           (before the 404 handler)
 */

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, {
  customSiteTitle: 'Jakson Solar API Docs',
  customCss: `
    .swagger-ui .topbar { background-color: #1a9fd4; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  `,
  swaggerOptions: {
    persistAuthorization: true,          // keeps the token across page refreshes
    displayRequestDuration: true,        // shows how long each request took
    filter: true,                        // adds a search bar at the top
    tryItOutEnabled: true,               // opens "Try it out" by default
  },
}));

/**
 *  ─────────────────────────────────────────────────────────────
 *  RESULT: Swagger UI will be live at
 *    http://localhost:5000/api/docs
 *  ─────────────────────────────────────────────────────────────
 *
 *  HOW TO AUTHENTICATE IN THE UI:
 *  1. Call POST /api/auth/login via "Try it out"
 *  2. Copy the token from the response
 *  3. Click the green "Authorize 🔒" button (top right)
 *  4. Paste:  Bearer <your_token>
 *  5. All protected endpoints will now work
 *  ─────────────────────────────────────────────────────────────
 */