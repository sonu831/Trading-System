import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/utils/theme-provider';
import { Card } from '@/components/ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Mock data generator
const generateMockData = () => {
  const labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  return {
    labels,
    datasets: [
      {
        label: 'Nifty 50',
        data: labels.map(() => 19000 + Math.random() * 1000),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Bank Nifty',
        data: labels.map(() => 43000 + Math.random() * 2000),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };
};

const MarketTrendChart = ({ data }) => {
  const { theme } = useTheme();

  const options = useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#9ca3af' : '#64748b'; // gray-400 : slate-500
    const gridColor = isDark ? '#374151' : '#e2e8f0'; // gray-700 : slate-200
    const titleColor = isDark ? '#f3f4f6' : '#1e293b'; // gray-100 : slate-800

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: textColor },
        },
        title: {
          display: true,
          text: 'Index Performance (Last 7 Days)',
          color: titleColor,
        },
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    };
  }, [theme]);

  const chartData = data || generateMockData();

  return (
    <Card className="h-96 w-full p-4 border-border bg-surface">
      <Line options={options} data={chartData} />
    </Card>
  );
};

MarketTrendChart.propTypes = {
  data: PropTypes.object,
};

export default MarketTrendChart;
