import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/agents')
      setAgents(r.data.agents)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const toggleFreeze = async (agent) => {
    setToggling(agent.id)
    try {
      await api.post(`/admin/agents/${agent.id}/freeze`, { freeze: !agent.is_frozen })
      toast.success(`Agent ${agent.is_frozen ? 'unfrozen' : 'frozen'}.`)
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setToggling(null) }
  }

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.phone.includes(search) ||
    (a.business_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">All Agents ({agents.length})</h1>
        <input
          className="input-field max-w-xs"
          placeholder="Search by name, phone, or business..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Agent</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Balance</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Approval</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No agents found</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium">{a.name}</div>
                  {a.business_name && <div className="text-xs text-gray-400">{a.business_name}</div>}
                </td>
                <td className="px-5 py-3 mono text-gray-500">{a.phone}</td>
                <td className="px-5 py-3 text-right font-bold mono text-primary">৳{a.balance?.toFixed(2)}</td>
                <td className="px-5 py-3 text-center">
                  {a.is_approved
                    ? <span className="badge-green">Approved</span>
                    : <span className="badge-yellow">Pending</span>}
                </td>
                <td className="px-5 py-3 text-center">
                  {a.is_frozen
                    ? <span className="badge-red">Frozen</span>
                    : <span className="badge-green">Active</span>}
                </td>
                <td className="px-5 py-3 text-center">
                  {a.is_approved && (
                    <button
                      disabled={toggling === a.id}
                      onClick={() => toggleFreeze(a)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all
                        ${a.is_frozen
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                      {toggling === a.id ? '...' : a.is_frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
