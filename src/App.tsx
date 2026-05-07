function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 20% 20%, rgba(244, 63, 94, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(244, 63, 94, 0.05) 0%, transparent 40%), var(--bg-app)',
      }}
    >
      <h1
        style={{
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}
      >
        ChatBotKur
      </h1>
      <p
        style={{
          marginTop: 12,
          color: 'var(--text-muted)',
          fontSize: 15,
        }}
      >
        Akıllı SSS Chatbot Platformu
      </p>
    </main>
  )
}

export default App
