import React from 'react';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#9ca3af',
      },
    },
    title: {
      display: true,
      text: 'Index Performance (Last 7 Days)',
      color: '#ffffff',
    },
  },
  scales: {
    y: {
      grid: {
        color: '#374151',
      },
      ticks: {
        color: '#9ca3af',
      },
    },
    x: {
      grid: {
        color: '#374151',
      },
      ticks: {
        color: '#9ca3af',
      },
    },
  },
};

// Mock data generator if real data is missing
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
  const chartData = data || generateMockData();
  return <Line options={options} data={chartData} />;
};

export default MarketTrendChart;
