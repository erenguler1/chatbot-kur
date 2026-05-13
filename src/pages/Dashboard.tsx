import { Header } from '../components/Header'

export function Dashboard() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Header />
      <main className="p-8">
        <h1 className="text-2xl font-bold">Hoşgeldin</h1>
        <p className="text-[var(--text-muted)] mt-2">Bot listesi yakında. (TODO Batch 2-3)</p>
      </main>
    </div>
  )
}
