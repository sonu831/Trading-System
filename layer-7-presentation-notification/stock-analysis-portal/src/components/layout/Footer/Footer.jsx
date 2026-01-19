import React from 'react';

const Footer = () => {
  return (
    <footer className="mt-12 border-t border-border pt-6 pb-6 text-center text-text-tertiary text-sm transition-colors duration-200">
      <p className="mb-2 font-medium text-text-secondary">
        &copy; {new Date().getFullYear()} Stock Analysis By Gurus. All rights reserved.
      </p>
      <p className="max-w-2xl mx-auto italic opacity-75">
        "This Application is designed by Yogendra and Utkarsh. Unauthorized reproduction or copying
        of these unique ideas will lead to legal action."
      </p>
    </footer>
  );
};

export default Footer;
