import '@/styles/globals.css';
import { ThemeProvider } from '../utils/theme-provider';
import { Provider } from 'react-redux';
import { store } from '@/store';

export default function App({ Component, pageProps }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <Component {...pageProps} />
      </ThemeProvider>
    </Provider>
  );
}
