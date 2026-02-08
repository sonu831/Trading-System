import '@/styles/globals.css';
import { ThemeProvider } from '../utils/theme-provider';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { NotificationProvider } from '@/context/NotificationContext';

import NotificationToast from '@/components/features/Notifications/NotificationToast';

export default function App({ Component, pageProps }) {
  return (
    <Provider store={store}>
      <NotificationProvider>
        <ThemeProvider>
          <NotificationToast />
          <Component {...pageProps} />
        </ThemeProvider>
      </NotificationProvider>
    </Provider>
  );
}
