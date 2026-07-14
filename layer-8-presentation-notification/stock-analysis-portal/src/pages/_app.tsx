// @ts-nocheck
import React from 'react';
import '@/styles/globals.css';
import { ThemeProvider } from '@/utils/theme-provider';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { ToastContainer } from '@/components/ui/Toast';

/**
 * Per-page layout pattern:
 *   - By default, pages self-wrap with <AppShell> (sidebar + safety bar).
 *   - Pages needing a fullscreen layout (system, backfill) render their own chrome.
 *   - Pages can export getLayout(page) → ReactNode for custom shells (scalp, cockpit).
 */
export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  const getLayout = (Component as any).getLayout || ((page: React.ReactNode) => page);

  return (
    <Provider store={store}>
      <ThemeProvider>
        {getLayout(<Component {...pageProps} />)}
        <ToastContainer />
      </ThemeProvider>
    </Provider>
  );
}
