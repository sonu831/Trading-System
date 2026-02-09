const BaseLayout = require('./BaseLayout');
const colors = require('./colors');

/**
 * Helper to escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a specific notification email using the BaseLayout.
 * Supports types: 'alert', 'success', 'info', 'warning'
 */
const NotificationEmail = ({ title, message, details, type = 'info', timestamp = new Date() }) => {
  
  let headerGradient = colors.gradients.primary;
  let icon = '📢';
  let accentColor = colors.accent.primary;

  switch(type) {
    case 'alert':
    case 'error':
    case 'system_down':
      headerGradient = colors.gradients.error;
      icon = '🚨';
      accentColor = colors.status.error;
      break;
    case 'success':
    case 'backfill':
    case 'recovery':
    case 'system_up':
      headerGradient = colors.gradients.success;
      icon = '✅';
      accentColor = colors.status.success;
      break;
    case 'warning':
      headerGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      icon = '⚠️';
      accentColor = colors.status.warning;
      break;
  }

  const formattedTime = new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  const content = `
    <!-- Hero Section -->
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
      <h2 style="color: ${colors.text.primary}; font-size: 20px; margin: 0; font-weight: 600;">${escapeHtml(title)}</h2>
      <div style="width: 40px; height: 3px; background: ${headerGradient}; margin: 15px auto; border-radius: 2px;"></div>
    </div>

    <!-- Message Body -->
    <div style="color: ${colors.text.secondary}; line-height: 1.6; font-size: 15px; margin-bottom: 25px; text-align: center;">
      ${escapeHtml(message).replace(/\n/g, '<br/>')}
    </div>

    <!-- Details Table (if any) -->
    ${details ? `
      <div style="background-color: rgba(255,255,255,0.03); border: 1px solid ${colors.border}; border-radius: 12px; padding: 15px; margin-bottom: 25px; font-size: 14px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${Object.entries(details).map(([key, value]) => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 10px 0; color: ${colors.text.tertiary}; text-transform: capitalize; font-weight: 500;">${key.replace(/_/g, ' ')}</td>
              <td style="padding: 10px 0; color: ${colors.text.primary}; text-align: right; font-family: monospace;">${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : ''}

    <!-- Metadata Footer -->
    <div style="border-top: 1px solid ${colors.border}; padding-top: 20px; font-size: 11px; text-align: center; color: ${colors.text.tertiary};">
      <p style="margin: 0;">Time: ${formattedTime} &bull; Type: <span style="color: ${accentColor}; font-weight: bold; text-transform: uppercase;">${type}</span></p>
    </div>
  `;

  return BaseLayout(content, title);
};

module.exports = NotificationEmail;
