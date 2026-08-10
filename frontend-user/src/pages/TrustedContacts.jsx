import { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function TrustedContacts() {
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ phone: '', name: '' })
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    const r = await api.get('/notifications/trusted-contacts')
    setContacts(r.data.contacts)
  }
  useEffect(() => { fetch() }, [])

  const add = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/notifications/trusted-contacts', form)
      toast.success('Contact added to trusted list!')
      setForm({ phone: '', name: '' })
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.')
    } finally { setLoading(false) }
  }

  const remove = async (id) => {
    if (!confirm('Remove this trusted contact?')) return
    await api.delete(`/notifications/trusted-contacts/${id}`)
    toast.success('Contact removed.')
    fetch()
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Trusted Contacts</h1>
      <p className="text-sm text-gray-500">Sending to numbers NOT on this list will show a ⚠️ warning.</p>

      <div className="card">
        <h2 className="font-bold mb-4">Add Trusted Contact</h2>
        <form onSubmit={add} className="space-y-3">
          <input className="input-field" type="tel" placeholder="Phone number (01XXXXXXXXX)"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
          <input className="input-field" placeholder="Nickname (optional)"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Adding...' : '+ Add to Trusted List'}
          </button>
        </form>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold">Trusted List ({contacts.length})</h2>
        </div>
        {contacts.length === 0 ? (
          <div className="text-center text-gray-400 py-10">No trusted contacts yet</div>
        ) : contacts.map(c => (
          <div key={c.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold">
                {(c.contact_name || c.contact_phone)[0].toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm">{c.contact_name || 'Contact'}</div>
                <div className="text-xs text-gray-400 mono">{c.contact_phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-green">✅ Trusted</span>
              <button onClick={() => remove(c.id)}
                className="text-xs text-red-400 hover:text-red-600 ml-2">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
