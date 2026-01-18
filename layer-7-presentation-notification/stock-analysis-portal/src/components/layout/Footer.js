import React from 'react';

const Footer = () => {
  return (
    <footer className="mt-12 border-t border-gray-800 pt-6 pb-6 text-center text-gray-500 text-sm">
      <p className="mb-2 font-medium text-gray-400">
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
