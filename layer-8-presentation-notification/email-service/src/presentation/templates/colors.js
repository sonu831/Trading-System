/**
 * Shared Design Tokens for Email Templates
 * Matches the Dashboard's Glassmorphism Palette
 */
const colors = {
  background: '#0f172a', // slate-900
  surface: '#1e293b',    // slate-800
  border: '#334155',     // slate-700
  
  text: {
    primary: '#f1f5f9',   // slate-100
    secondary: '#94a3b8', // slate-400
    tertiary: '#64748b',  // slate-500
  },

  accent: {
    primary: '#6366f1',   // indigo-500
    secondary: '#8b5cf6', // violet-500
  },

  status: {
    success: '#10b981', // emerald-500
    error: '#ef4444',   // rose-500
    warning: '#f59e0b', // amber-500
    info: '#3b82f6',    // blue-500
  },

  gradients: {
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
    primary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    error: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
  },
};

module.exports = colors;
