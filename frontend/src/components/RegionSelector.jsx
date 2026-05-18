export default function RegionSelector({ regions, selected, onChange }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 flex flex-wrap items-center gap-4">
      <label htmlFor="region-select" className="text-gray-300 font-medium">
        Region
      </label>
      <select
        id="region-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white
                   focus:border-amber-500 focus:outline-none cursor-pointer"
      >
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {selected && regions.length > 0 && (
        <span className="text-gray-500 text-sm">
          {regions.find((r) => r.id === selected)?.lat}°N,{' '}
          {regions.find((r) => r.id === selected)?.lon}°E
        </span>
      )}
    </div>
  )
}
