const TOP_VINTAGES = new Set([2000, 2005, 2009, 2010, 2016, 2022])

function StatCard({ label, value, sub, highlight }) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlight ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-gray-800'
      }`}
    >
      <p className={`text-xs mb-1 ${highlight ? 'text-amber-300' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-2xl font-bold font-mono ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function WeatherDetailPanel({ scores, year }) {
  const data = scores.find((s) => s.year === year)
  if (!data) return null

  const isTop = TOP_VINTAGES.has(year)

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h2 className="text-xl font-semibold">{year} — Weather Detail</h2>
        {isTop && (
          <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded font-medium">
            ★ Known Top Vintage
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Ashenfelter Score"
          value={data.score?.toFixed(3)}
          highlight
        />
        <StatCard
          label="Winter Rain"
          value={`${data.winter_rain} mm`}
          sub="October – March"
        />
        <StatCard
          label="Growth Temperature"
          value={`${data.growth_temp?.toFixed(1)} °C`}
          sub="April – September avg."
        />
        <StatCard
          label="Harvest Rain"
          value={`${data.harvest_rain} mm`}
          sub="August – September"
        />
      </div>

      <p className="text-gray-600 text-xs mt-4">
        Formula: score = −12.145 + 0.00117×WinterRain + 0.0614×GrowthTemp − 0.00386×HarvestRain
      </p>
    </div>
  )
}
