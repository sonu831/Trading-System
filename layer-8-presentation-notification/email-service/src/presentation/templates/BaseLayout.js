const colors = require('./colors');

/**
 * BaseLayout: The outer wrapper for all system emails.
 * Uses inline styles for maximum email client compatibility.
 * Implements "Glassmorphism" look using dark backgrounds and borders.
 */
const BaseLayout = (content, title = 'Notification') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${colors.text.secondary};">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: ${colors.text.primary}; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">
        Guru Ji <span style="color: ${colors.accent.primary}">Trading</span>
      </h1>
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: ${colors.text.tertiary}; margin-top: 5px;">
        Institutional Grade Analytics
      </p>
    </div>

    <!-- Glass Container -->
    <div style="background-color: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);">
      
      <!-- Content Area -->
      <div style="padding: 30px;">
        ${content}
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; font-size: 12px; color: ${colors.text.tertiary};">
      <p style="margin-bottom: 5px;">&copy; ${new Date().getFullYear()} Guru Ji Trading System. All rights reserved.</p>
      <p>Automated Notification • Do not reply</p>
    </div>

  </div>
</body>
</html>
`;

module.exports = BaseLayout;
