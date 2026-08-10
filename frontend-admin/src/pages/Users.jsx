import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function Users() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/users')
      setUsers(r.data.users)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const toggleFreeze = async (user) => {
    setToggling(user.id)
    try {
      await api.post(`/admin/users/${user.id}/freeze`, { freeze: !user.is_frozen })
      toast.success(`Account ${user.is_frozen ? 'unfrozen' : 'frozen'}.`)
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setToggling(null) }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">All Users ({users.length})</h1>
        <input
          className="input-field max-w-xs"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">User</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Balance</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold text-sm">
                      {u.name[0]}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 mono text-gray-500">{u.phone}</td>
                <td className="px-5 py-3 text-right font-bold mono text-primary">৳{u.balance?.toFixed(2)}</td>
                <td className="px-5 py-3 text-center">
                  {u.is_frozen
                    ? <span className="badge-red">Frozen</span>
                    : <span className="badge-green">Active</span>}
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    disabled={toggling === u.id}
                    onClick={() => toggleFreeze(u)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all
                      ${u.is_frozen
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {toggling === u.id ? '...' : u.is_frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
