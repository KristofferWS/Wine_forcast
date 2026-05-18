function PhaseRow({ label, value, unit, done, partial }) {
  const dot = done
    ? 'bg-green-500'
    : partial
    ? 'bg-amber-500 animate-pulse'
    : 'bg-gray-600'

  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {value !== undefined ? (
          <span className="text-white font-mono">
            {value} {unit}
          </span>
        ) : (
          <span className="text-gray-600 italic text-xs">not yet available</span>
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      </div>
    </div>
  )
}

export default function CurrentSeasonWidget({ data: apiData }) {
  const {
    year,
    progress,
    partial_score,
    is_estimate,
    data: weather,
    winter_complete,
    growth_available,
    harvest_available,
  } = apiData

  return (
    <div className="bg-gray-900 rounded-lg p-6 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-1">Current Season</h2>
      <p className="text-gray-400 text-sm mb-5">{year} vintage in progress</p>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-300">Season progress</span>
          <span className="text-amber-400 font-semibold">{progress}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-amber-600 to-amber-400 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Oct</span>
          <span>Mar</span>
          <span>Sep</span>
        </div>
      </div>

      {/* Estimated score */}
      {partial_score !== null ? (
        <div className="bg-gray-800 rounded-lg p-4 mb-5 text-center">
          <p className="text-gray-400 text-xs mb-1">
            {is_estimate ? 'Estimated Score*' : 'Final Score'}
          </p>
          <p className="text-4xl font-bold text-amber-400 font-mono">
            {partial_score.toFixed(2)}
          </p>
          {is_estimate && (
            <p className="text-gray-600 text-xs mt-1">
              * harvest rain not yet available
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4 mb-5 text-center">
          <p className="text-gray-500 text-sm">Score available after April</p>
        </div>
      )}

      {/* Phase breakdown */}
      <div className="flex-1">
        <PhaseRow
          label="Winter Rain (Oct–Mar)"
          value={weather.winter_rain}
          unit="mm"
          done={winter_complete}
          partial={!winter_complete && weather.winter_rain !== undefined}
        />
        <PhaseRow
          label="Growth Temp (Apr–Sep)"
          value={weather.growth_temp}
          unit="°C"
          done={harvest_available}
          partial={growth_available && !harvest_available}
        />
        <PhaseRow
          label="Harvest Rain (Aug–Sep)"
          value={weather.harvest_rain}
          unit="mm"
          done={progress === 100}
          partial={harvest_available && progress < 100}
        />
      </div>
    </div>
  )
}
