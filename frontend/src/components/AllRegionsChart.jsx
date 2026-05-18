import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const COLORS = ['#F59E0B', '#60A5FA', '#34D399', '#F87171', '#A78BFA', '#FB923C']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <p key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
            <span className="truncate">{p.name}</span>
            <span className="font-mono text-white">{p.value?.toFixed(2)}</span>
          </p>
        ))}
    </div>
  )
}

export default function AllRegionsChart({ regions }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!regions.length) return
    setLoading(true)
    setError(null)

    Promise.all(regions.map((r) => fetch(`/api/scores/${r.id}`).then((res) => res.json())))
      .then((allScores) => {
        const byYear = {}
        allScores.forEach((scores, i) => {
          scores.forEach(({ year, score }) => {
            if (!byYear[year]) byYear[year] = { year }
            byYear[year][regions[i].id] = score
          })
        })
        setData(Object.values(byYear).sort((a, b) => a.year - b.year))
      })
      .catch(() => setError('Failed to load scores for all regions.'))
      .finally(() => setLoading(false))
  }, [regions])

  if (loading) return (
    <div className="bg-gray-900 rounded-lg p-6 text-center text-gray-400 py-16">
      Loading all regions…
    </div>
  )

  if (error) return (
    <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
      {error}
    </div>
  )

  if (!data.length) return null

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-1">All Regions — Vintage Scores</h2>
      <p className="text-gray-400 text-sm mb-5">
        Ashenfelter index per region, 2000 – present. Higher = better growing conditions.
      </p>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9CA3AF' }}
            formatter={(value) => regions.find((r) => r.id === value)?.name ?? value}
          />
          {regions.map((r, i) => (
            <Line
              key={r.id}
              type="monotone"
              dataKey={r.id}
              name={r.id}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
