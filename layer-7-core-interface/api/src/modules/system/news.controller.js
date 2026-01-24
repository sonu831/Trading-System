const getNews = async (request, reply) => {
  const news = [
    {
      id: 1,
      headline: 'Nifty 50 hits all-time high amidst strong FII inflows',
      source: 'MarketWire',
      time: '10:30 AM',
      sentiment: 'positive',
    },
    {
      id: 2,
      headline: 'Reliance Industries announces quarterly results surpassing estimates',
      source: 'Financial Express',
      time: '09:45 AM',
      sentiment: 'positive',
    },
    {
      id: 3,
      headline: 'IT Sector under pressure as global recession fears loom',
      source: 'Bloomberg',
      time: '11:15 AM',
      sentiment: 'negative',
    },
    {
      id: 4,
      headline: 'HDFC Bank merger update: Integration properly on track',
      source: 'CNBC TV18',
      time: '08:00 AM',
      sentiment: 'neutral',
    },
    {
      id: 5,
      headline: 'Gold prices surge as investors seek safe haven',
      source: 'Reuters',
      time: '12:00 PM',
      sentiment: 'neutral',
    },
  ];

  return { success: true, count: news.length, data: news };
};

module.exports = {
  getNews,
};
