import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const TOP_VINTAGES = new Set([2000, 2005, 2009, 2010, 2016, 2022])

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-700 rounded p-3 text-sm shadow-lg">
      <p className="font-bold text-amber-400 mb-1">
        {d.year}
        {TOP_VINTAGES.has(d.year) ? ' ★' : ''}
      </p>
      <p className="text-gray-300">
        Score: <span className="text-white font-mono">{d.score?.toFixed(3)}</span>
      </p>
      <p className="text-gray-400 text-xs mt-1">Click bar for weather details</p>
    </div>
  )
}

export default function VintageScoreChart({ scores, onSelectYear, selectedYear }) {
  const handleClick = (data) => {
    const year = data?.activePayload?.[0]?.payload?.year
    if (year) onSelectYear(year === selectedYear ? null : year)
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-1">Vintage Scores 2000 – present</h2>
      <p className="text-gray-400 text-sm mb-5">
        Ashenfelter index — higher = better growing conditions.{' '}
        <span className="text-amber-500">★ Known top vintages</span>
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={scores}
          onClick={handleClick}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
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
            domain={['auto', 'auto']}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="score" radius={[3, 3, 0, 0]} cursor="pointer" maxBarSize={28}>
            {scores.map((s) => (
              <Cell
                key={s.year}
                fill={
                  s.year === selectedYear
                    ? '#FCD34D'
                    : TOP_VINTAGES.has(s.year)
                    ? '#D97706'
                    : '#4B5563'
                }
                opacity={selectedYear && s.year !== selectedYear ? 0.6 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-5 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" />
          Top vintage (2000, 2005, 2009, 2010, 2016, 2022)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-600 inline-block" />
          Standard vintage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block" />
          Selected
        </span>
      </div>
    </div>
  )
}
