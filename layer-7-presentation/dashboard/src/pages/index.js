import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Nifty 50 Trading System</title>
        <meta name="description" content="Real-time Trading Signals" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#0070f3' }}>🚀 Nifty 50 Trading System</h1>
        <p>Connecting to Real-time Stream...</p>
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f0f0', borderRadius: '8px' }}>
          <strong>Status:</strong> Waiting for Signals...
        </div>
      </main>
    </>
  )
}
