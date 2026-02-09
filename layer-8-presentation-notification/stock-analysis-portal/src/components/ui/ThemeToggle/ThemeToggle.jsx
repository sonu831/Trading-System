import React from 'react';
import { useTheme } from '../../../utils/theme-provider';
import Button from '../Button';

/**
 * ThemeToggle Component
 * Button to toggle between light and dark themes
 */
export default function ThemeToggle({ className = '', ...props }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`relative w-8 h-8 p-0 flex items-center justify-center overflow-hidden ${className}`}
      aria-label="Toggle Theme"
      {...props}
    >
      {/* Sun Icon for Light Mode (shown when dark) */}
      <svg
        className={`w-5 h-5 absolute transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
        }`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      {/* Moon Icon for Dark Mode (shown when light) */}
      <svg
        className={`w-5 h-5 absolute transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          !isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
        }`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </Button>
  );
}
