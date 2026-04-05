import { useEffect, useMemo, useState } from 'react'
import type { CampusOption, SearchFilters, SearchResponse, TimeSlotOption } from './types'

const campusOptions: CampusOption[] = [
  { value: 'xitucheng', label: '西土城校区' },
  { value: 'shahe', label: '沙河校区' },
]

const today = new Date().toISOString().split('T')[0]

const timeSlotOptions: TimeSlotOption[] = [
  { value: '08:00-08:45', label: '第 1 节 · 08:00 - 08:45' },
  { value: '08:50-09:35', label: '第 2 节 · 08:50 - 09:35' },
  { value: '09:50-10:35', label: '第 3 节 · 09:50 - 10:35' },
  { value: '10:40-11:25', label: '第 4 节 · 10:40 - 11:25' },
  { value: '11:30-12:15', label: '第 5 节 · 11:30 - 12:15' },
  { value: '13:00-13:45', label: '第 6 节 · 13:00 - 13:45' },
  { value: '13:50-14:35', label: '第 7 节 · 13:50 - 14:35' },
  { value: '14:45-15:30', label: '第 8 节 · 14:45 - 15:30' },
  { value: '15:40-16:25', label: '第 9 节 · 15:40 - 16:25' },
  { value: '16:35-17:20', label: '第 10 节 · 16:35 - 17:20' },
  { value: '17:25-18:10', label: '第 11 节 · 17:25 - 18:10' },
  { value: '18:30-19:15', label: '第 12 节 · 18:30 - 19:15' },
  { value: '19:20-20:05', label: '第 13 节 · 19:20 - 20:05' },
  { value: '20:10-20:55', label: '第 14 节 · 20:10 - 20:55' },
]

const initialFilters: SearchFilters = {
  campus: 'xitucheng',
  date: today,
  building: '',
  floor: '',
  timeSlots: [timeSlotOptions[0].value],
}

function App() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [buildingOptions, setBuildingOptions] = useState<string[]>([])
  const [floorOptions, setFloorOptions] = useState<string[]>([])
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadBuildings() {
      try {
        setError('')
        const response = await fetch(`api/buildings?campus=${filters.campus}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('教学楼列表获取失败')
        }
        const data = await response.json()
        if (data && Array.isArray(data.buildings)) {
          setBuildingOptions(data.buildings)
          setFilters((current) => ({
            ...current,
            building: data.buildings.includes(current.building) ? current.building : data.buildings[0] ?? '',
          }))
        } else {
          setBuildingOptions([])
          console.warn('后端返回格式非预期:', data)
        }
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }
        setBuildingOptions([])
        setError('暂时无法加载教学楼列表，请稍后重试。')
      }
    }

    loadBuildings()

    return () => controller.abort()
  }, [filters.campus])

  useEffect(() => {
    if (!filters.building) {
      return
    }
    const controller = new AbortController()

    async function loadFloors() {
      try {
        const query = new URLSearchParams({
          campus: filters.campus,
          building: filters.building,
        })
        const response = await fetch(`api/floors?${query.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('楼层列表获取失败')
        }

        const data = await response.json()
        setFloorOptions(data.floors)
        setFilters((current) => ({
          ...current,
          floor: data.floors.includes(current.floor) ? current.floor : '',
        }))
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setFloorOptions([])
        setFilters((current) => ({
          ...current,
          floor: '',
        }))
      }
    }

    loadFloors()

    return () => controller.abort()
  }, [filters.campus, filters.building])

  useEffect(() => {
    if (!filters.building || filters.timeSlots.length === 0) {
      return
    }
    handleSearch()
  }, [filters.campus, filters.date, filters.building, filters.floor, filters.timeSlots])

  const occupancyRate = useMemo(() => {
    // 使用 可选链 ?. 确保即使 result 或 summary 是空的，也不会崩溃
    if (!result?.summary || result.summary.total === 0) {
      return 0
    }
    return Math.round((result.summary.busy / result.summary.total) * 100)
  }, [result])

  const selectedTimeSlotLabels = useMemo(() => {
    const labels = timeSlotOptions
      .filter((option) => filters.timeSlots.includes(option.value))
      .map((option) => option.label)

    return labels.length > 0 ? labels.join('、') : '未选择时间段'
  }, [filters.timeSlots])

  async function handleSearch() {
    if (!filters.building || filters.timeSlots.length === 0) {
      return
    }

    try {
      setLoading(true)
      setError('')
      const query = new URLSearchParams({
        campus: filters.campus,
        building: filters.building,
        date: filters.date,
      })
      if (filters.floor) {
        query.set('floor', filters.floor)
      }
      filters.timeSlots.forEach((timeSlot) => {
        query.append('timeSlot', timeSlot)
      })
      const response = await fetch(`api/availability?${query.toString()}`)
      if (!response.ok) {
        throw new Error('查询失败')
      }
      const data = (await response.json()) as SearchResponse
      setResult(data)
    } catch {
      setError('暂时无法查询空教室，请检查后端服务是否正常。')
    } finally {
      setLoading(false)
    }
  }

  function updateFilter<Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function toggleTimeSlot(timeSlot: string) {
    setFilters((current) => {
      const alreadySelected = current.timeSlots.includes(timeSlot)
      const nextTimeSlots = alreadySelected ? current.timeSlots.filter((item) => item !== timeSlot) : [...current.timeSlots, timeSlot]

      return {
        ...current,
        timeSlots: nextTimeSlots,
      }
    })
  }

  return (
    <div className="page-shell">
      <div className="page-background page-background-left" />
      <div className="page-background page-background-right" />

      <main className="layout">
        <section className="hero-card">
          <div className="hero-text">
            <span className="hero-badge">BUPT Intelligent Space</span>
            <h1>北邮空教室查询</h1>
            <p>
              面向校区、日期、教学楼与节次的空闲教室检索，支持多节次交集筛选，帮助你快速定位合适的学习空间。
            </p>
          </div>

          <div className="hero-highlights">
            <div className="highlight-card">
              <span>校区</span>
              <strong>{campusOptions.find((item) => item.value === filters.campus)?.label}</strong>
            </div>
            <div className="highlight-card">
              <span>日期</span>
              <strong>{filters.date}</strong>
            </div>
            <div className="highlight-card">
              <span>节次</span>
              <strong>{selectedTimeSlotLabels}</strong>
            </div>
            <div className="highlight-card">
              <span>楼层</span>
              <strong>{filters.floor || '全部楼层'}</strong>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <section className="panel search-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">查询条件</span>
                <h2>快速筛选</h2>
              </div>
              <button className="primary-button" type="button" onClick={handleSearch} disabled={loading || !filters.building || filters.timeSlots.length === 0}>
                {loading ? '查询中...' : '查询空教室'}
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>校区</span>
                <select value={filters.campus} onChange={(event) => updateFilter('campus', event.target.value as SearchFilters['campus'])}>
                  {campusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>日期</span>
                <input type="date" value={filters.date} min={today} onChange={(event) => updateFilter('date', event.target.value)} />
              </label>

              <label className="form-field">
                <span>教学楼</span>
                <select value={filters.building} onChange={(event) => updateFilter('building', event.target.value)} disabled={buildingOptions.length === 0}>
                  {buildingOptions.map((building) => (
                    <option key={building} value={building}>
                      {building}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>楼层</span>
                <select value={filters.floor} onChange={(event) => updateFilter('floor', event.target.value)} disabled={!filters.building}>
                  <option value="">全部楼层</option>
                  {floorOptions.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>节次</span>
                <div className="time-slot-grid">
                  {timeSlotOptions.map((option) => (
                    <button
                      className={`time-slot-chip ${filters.timeSlots.includes(option.value) ? 'selected' : ''}`}
                      key={option.value}
                      type="button"
                      onClick={() => toggleTimeSlot(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

          </section>

          <section className="panel result-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">查询结果</span>
                <h2>空闲情况概览</h2>
              </div>
            </div>

            <div className="result-console-bar">
              <span className="console-pill active">Live Query</span>
              <span className="console-pill">Classroom Matrix</span>
              <span className="console-pill">Signal Stable</span>
            </div>

            {error ? <div className="status-banner error">{error}</div> : null}

            {result ? (
              <>
                <div className="stats-grid">
                  <article className="stat-card">
                    <div className="stat-label">
                      <span className="pulse-dot neutral" />
                      <span>教室总数</span>
                    </div>
                    <strong>{result.summary.total}</strong>
                  </article>
                  <article className="stat-card success">
                    <div className="stat-label">
                      <span className="pulse-dot available" />
                      <span>空闲教室</span>
                    </div>
                    <strong>{result.summary.available}</strong>
                  </article>
                  <article className="stat-card warning">
                    <div className="stat-label">
                      <span className="pulse-dot busy" />
                      <span>占用教室</span>
                    </div>
                    <strong>{result.summary.busy}</strong>
                  </article>
                </div>

                <div className="overview-card">
                  <div>
                    <span className="overview-label">当前查询</span>
                    <h3>
                      {result.query.campus} · {result.query.building}
                    </h3>
                    <p>
                      {result.query.date} / {result.query.floor} / {timeSlotOptions
                        .filter((option) => result.query.timeSlots.includes(option.value))
                        .map((option) => option.label)
                        .join('、')}
                    </p>
                  </div>
                  <div className="overview-progress">
                    <div className="progress-copy">
                      <span>占用率</span>
                      <strong>{occupancyRate}%</strong>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${occupancyRate}%` }} />
                    </div>
                  </div>
                </div>

                <div className="classroom-list">
                  {result.classrooms.map((room) => (
                    <article className={`classroom-card ${room.status}`} key={room.room}>
                      <div className="classroom-main">
                        <div>
                          <div className="room-signal-row">
                            <span className={`pulse-dot ${room.status}`} />
                            <span className="room-signal-text">{room.status === 'available' ? '全时段可用' : '存在占用'}</span>
                          </div>
                          <div className="room-row">
                            <h3>{room.room}</h3>
                            <span className={`status-chip ${room.status}`}>{room.status === 'available' ? '空闲' : '占用'}</span>
                          </div>
                          <p>{room.description}</p>
                        </div>
                      </div>

                      <div className="classroom-meta">
                        <span>楼层：{room.floor}</span>
                        <span>容量：{room.capacity} 人</span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h3>开始查询</h3>
                <p>选择校区、日期、教学楼和节次后，即可查看符合条件的空闲教室。</p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}

export default App
