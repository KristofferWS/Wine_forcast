import { useEffect, useState } from 'react'
import CurrentSeasonWidget from './components/CurrentSeasonWidget'
import RegionSelector from './components/RegionSelector'
import VintageScoreChart from './components/VintageScoreChart'
import WeatherDetailPanel from './components/WeatherDetailPanel'

export default function App() {
  const [regions, setRegions] = useState([])
  const [selectedRegion, setSelectedRegion] = useState('pauillac')
  const [scores, setScores] = useState([])
  const [currentSeason, setCurrentSeason] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/regions')
      .then((r) => r.json())
      .then(setRegions)
      .catch(() => setError('Could not reach the backend API.'))
  }, [])

  useEffect(() => {
    if (!selectedRegion) return
    setLoading(true)
    setError(null)
    setScores([])
    setCurrentSeason(null)
    setSelectedYear(null)

    Promise.all([
      fetch(`/api/scores/${selectedRegion}`).then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      }),
      fetch(`/api/current-season/${selectedRegion}`).then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      }),
    ])
      .then(([scoresData, seasonData]) => {
        setScores(scoresData)
        setCurrentSeason(seasonData)
      })
      .catch((err) => setError(`Failed to load data: ${err.message}`))
      .finally(() => setLoading(false))
  }, [selectedRegion])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-5">
        <h1 className="text-2xl font-bold text-amber-400 tracking-tight">
          Bordeaux Wine Quality Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Ashenfelter model — weather-based vintage quality index
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <RegionSelector
          regions={regions}
          selected={selectedRegion}
          onChange={setSelectedRegion}
        />

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-lg mb-2">Loading vintage data…</div>
            <div className="text-sm text-gray-600">
              First load fetches 25+ years of weather data — may take up to 30 seconds.
            </div>
          </div>
        )}

        {!loading && scores.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <VintageScoreChart
                  scores={scores}
                  onSelectYear={setSelectedYear}
                  selectedYear={selectedYear}
                />
              </div>
              <div>
                {currentSeason && <CurrentSeasonWidget data={currentSeason} />}
              </div>
            </div>

            {selectedYear ? (
              <WeatherDetailPanel scores={scores} year={selectedYear} />
            ) : (
              <p className="text-center text-gray-600 text-sm py-2">
                Click a bar to see weather details for that vintage.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
