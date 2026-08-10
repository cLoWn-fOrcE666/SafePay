import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

/*
  We load Leaflet from CDN dynamically so we don't need to change package.json.
  This is the cleanest approach for adding a map without touching npm.
*/

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(window.L); return }

    // Inject CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    // Inject JS
    const script   = document.createElement('script')
    script.src     = LEAFLET_JS
    script.onload  = () => resolve(window.L)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

// Pin colours
const PIN_CURRENT  = '#10B981'   // green  — most recent login
const PIN_NORMAL   = '#3B82F6'   // blue   — previous logins
const PIN_NEW_LOC  = '#F59E0B'   // amber  — first time from this city
const PIN_FLAGGED  = '#EF4444'   // red    — flagged by user

function makeIcon(L, color, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function pinColor(loc, idx) {
  if (loc.is_flagged)      return PIN_FLAGGED
  if (idx === 0)            return PIN_CURRENT
  if (loc.is_new_location)  return PIN_NEW_LOC
  return PIN_NORMAL
}

export default function LoginMap() {
  const mapRef      = useRef(null)
  const leafletMap  = useRef(null)
  const markersRef  = useRef([])

  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [flagging,  setFlagging]  = useState(null)

  // ── fetch locations ────────────────────────────────────────────────────────
  const fetchLocations = async () => {
    try {
      const r = await api.get('/auth/login-locations')
      setLocations(r.data.locations)
    } catch { toast.error('Could not load login history.') }
    setLoading(false)
  }

  useEffect(() => { fetchLocations() }, [])

  // ── init / update map when locations change ────────────────────────────────
  useEffect(() => {
    if (loading || !locations.length || !mapRef.current) return

    loadLeaflet().then(L => {
      if (!L) return

      // Init map once
      if (!leafletMap.current) {
        leafletMap.current = L.map(mapRef.current, {
          center:  [23.8103, 90.4125],   // Dhaka
          zoom:    6,
          zoomControl: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(leafletMap.current)
      }

      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const valid = locations.filter(l => l.latitude && l.longitude)
      if (!valid.length) return

      valid.forEach((loc, idx) => {
        const color  = pinColor(loc, idx)
        const icon   = makeIcon(L, color, idx === 0 ? 18 : 13)
        const isLatest = idx === 0
        const time   = new Date(loc.created_at).toLocaleString('en-BD')
        const badge  = loc.is_flagged    ? '🚨 Flagged'
                     : isLatest          ? '📍 Latest Login'
                     : loc.is_new_location ? '⚠️ New City'
                     : '✅ Normal'

        const popup = L.popup({ maxWidth: 220 }).setContent(`
          <div style="font-family:sans-serif;font-size:13px;line-height:1.5">
            <div style="font-weight:700;margin-bottom:4px">${badge}</div>
            <div>📍 ${loc.city}, ${loc.region}</div>
            <div style="color:#6b7280;font-size:11px">${loc.country}</div>
            <div style="color:#6b7280;font-size:11px;margin-top:2px">🕐 ${time}</div>
            ${loc.ip_address ? `<div style="color:#9ca3af;font-size:10px;margin-top:2px">IP: ${loc.ip_address}</div>` : ''}
          </div>
        `)

        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(leafletMap.current)
          .bindPopup(popup)
        markersRef.current.push(marker)
      })

      // Fit map to show all markers
      if (valid.length === 1) {
        leafletMap.current.setView([valid[0].latitude, valid[0].longitude], 7)
      } else {
        const group = L.featureGroup(markersRef.current)
        leafletMap.current.fitBounds(group.getBounds().pad(0.3))
      }

      // Draw lines connecting logins in order (oldest → newest)
      const reversed = [...valid].reverse()
      if (reversed.length >= 2) {
        const coords = reversed.map(l => [l.latitude, l.longitude])
        L.polyline(coords, {
          color: '#94A3B8', weight: 1.5, dashArray: '5, 7', opacity: 0.6,
        }).addTo(leafletMap.current)
      }
    })
  }, [locations, loading])

  // Cleanup map on unmount
  useEffect(() => () => {
    if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null }
  }, [])

  // ── flag a login ───────────────────────────────────────────────────────────
  const flagLocation = async (locId) => {
    if (!confirm('Flag this login as "This wasn\'t me"? Admin will be alerted.')) return
    setFlagging(locId)
    try {
      await api.post(`/auth/login-locations/${locId}/flag`)
      toast.success('Login flagged. Admin has been notified.')
      fetchLocations()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not flag location.')
    } finally { setFlagging(null) }
  }

  const newLocations     = locations.filter(l => l.is_new_location && !l.is_flagged)
  const flaggedLocations = locations.filter(l => l.is_flagged)
  const uniqueCities     = [...new Set(locations.map(l => l.city).filter(Boolean))]

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Login Location Map 🗺️</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every time you log in, we record the location. If you see a login you don't
          recognise, flag it immediately.
        </p>
      </div>

      {/* ── Alert banner for new-city logins ── */}
      {newLocations.length > 0 && (
        <div className="card bg-yellow-50 border-2 border-yellow-300 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span className="font-bold text-yellow-800">
              Unfamiliar login location detected
            </span>
          </div>
          {newLocations.slice(0, 2).map(l => (
            <div key={l.id}
              className="flex items-center justify-between bg-white rounded-xl px-3 py-2">
              <div>
                <span className="font-medium text-sm">{l.city}, {l.region}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {new Date(l.created_at).toLocaleString('en-BD')}
                </span>
              </div>
              <button
                onClick={() => flagLocation(l.id)}
                disabled={flagging === l.id}
                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg
                  hover:bg-red-600 font-semibold">
                {flagging === l.id ? '...' : '🚨 Not me!'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-extrabold text-primary">{locations.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Logins Recorded</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-extrabold text-blue-600">{uniqueCities.length}</div>
          <div className="text-xs text-gray-500 mt-1">Unique Cities</div>
        </div>
        <div className="card text-center">
          <div className={`text-2xl font-extrabold ${flaggedLocations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {flaggedLocations.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Flagged Logins</div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-bold">Login Locations</h3>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> Latest
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> Previous
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" /> New city
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> Flagged
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            Loading map...
          </div>
        ) : locations.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            No login history yet.
          </div>
        ) : (
          <div ref={mapRef} style={{ height: '340px', width: '100%' }} />
        )}
      </div>

      {/* ── Login history list ── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-bold">
          Login History
        </div>
        {locations.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No logins recorded yet</div>
        ) : locations.map((loc, idx) => (
          <div key={loc.id}
            className={`flex items-center justify-between px-5 py-3.5
              border-b border-gray-50 last:border-0
              ${loc.is_flagged ? 'bg-red-50' : idx === 0 ? 'bg-green-50/40' : ''}`}>
            <div className="flex items-center gap-3">
              {/* Colour dot */}
              <div className={`w-3 h-3 rounded-full flex-shrink-0`}
                style={{ background: pinColor(loc, idx) }} />
              <div>
                <div className="font-medium text-sm">
                  {loc.city}{loc.region ? `, ${loc.region}` : ''}
                  {idx === 0 && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                  {loc.is_new_location && !loc.is_flagged && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      ⚠️ New city
                    </span>
                  )}
                  {loc.is_flagged && (
                    <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                      🚨 Flagged
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                  <span>🕐 {new Date(loc.created_at).toLocaleString('en-BD')}</span>
                  {loc.ip_address && <span className="mono">IP: {loc.ip_address}</span>}
                </div>
              </div>
            </div>

            {!loc.is_flagged ? (
              <button
                onClick={() => flagLocation(loc.id)}
                disabled={flagging === loc.id}
                className="text-xs text-red-500 hover:bg-red-50 border border-red-200
                  px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all">
                {flagging === loc.id ? '...' : '🚨 Not me!'}
              </button>
            ) : (
              <span className="text-xs text-red-400 font-medium">Reported ✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
