import useSWR from 'swr';
import axios from 'axios';

const fetcher = (url) => axios.get(url).then((res) => res.data);

export function useStockAnalysis(symbol, interval = '15m') {
  const { data, error, isLoading } = useSWR(
    symbol ? `/api/market/analysis/${symbol}?interval=${interval}` : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
    }
  );

  return {
    analysis: data,
    isLoading,
    isError: error,
  };
}
