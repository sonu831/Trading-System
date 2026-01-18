import React from 'react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, viewMode, setViewMode, systemStatus }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-grow">
        <Header viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus} />
        <main>{children}</main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
