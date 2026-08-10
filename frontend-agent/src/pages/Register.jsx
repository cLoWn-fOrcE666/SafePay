import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

function FileUploadBox({ label, hint, onChange, preview }) {
  const ref = useRef()
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <div
        onClick={() => ref.current.click()}
        className={`relative w-full h-28 rounded-xl border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center transition-all
          ${preview
            ? 'border-primary bg-primary-light/30'
            : 'border-gray-300 hover:border-primary bg-gray-50'}`}>
        {preview ? (
          <img src={preview} alt="preview" className="h-full w-full object-cover rounded-xl" />
        ) : (
          <>
            <span className="text-3xl">📷</span>
            <span className="text-xs text-gray-400 mt-1 text-center px-2">{hint}</span>
          </>
        )}
        <input
          ref={ref} type="file" className="hidden"
          accept="image/png,image/jpeg,image/webp"
          onChange={e => onChange(e.target.files[0])}
        />
      </div>
      {preview && (
        <button
          type="button"
          onClick={() => { onChange(null); ref.current.value = '' }}
          className="text-xs text-red-400 mt-1 hover:text-red-600">
          ✕ Remove
        </button>
      )}
    </div>
  )
}

export default function Register() {
  const [form, setForm] = useState({
    phone: '', name: '', pin: '', confirmPin: '', business_name: '',
  })
  const [files,    setFiles]    = useState({ nid_front: null, nid_back: null, selfie: null })
  const [previews, setPreviews] = useState({ nid_front: null, nid_back: null, selfie: null })
  const [done,    setDone]    = useState(false)
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const setFile = key => file => {
    if (!file) {
      setFiles(f => ({ ...f, [key]: null }))
      setPreviews(p => ({ ...p, [key]: null }))
      return
    }
    setFiles(f => ({ ...f, [key]: file }))
    const reader = new FileReader()
    reader.onload = e => setPreviews(p => ({ ...p, [key]: e.target.result }))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.pin !== form.confirmPin) return toast.error('PINs do not match.')
    if (form.pin.length < 4) return toast.error('PIN must be at least 4 digits.')
    if (!files.nid_front || !files.nid_back || !files.selfie) {
      return toast.error('Please upload NID front, NID back, and a selfie.')
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('phone',         form.phone)
      fd.append('name',          form.name)
      fd.append('pin',           form.pin)
      fd.append('business_name', form.business_name)
      fd.append('nid_front',     files.nid_front)
      fd.append('nid_back',      files.nid_back)
      fd.append('selfie',        files.selfie)

      const res  = await fetch('/api/auth/agent/register', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'Registration failed.')
      setDone(true)
    } catch {
      toast.error('Network error. Is the backend running?')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-100 to-white px-4">
      <div className="card max-w-sm w-full text-center space-y-5">
        <div className="text-5xl">⏳</div>
        <h2 className="text-xl font-bold text-primary">Registration Submitted!</h2>
        <div className="bg-primary-light rounded-xl p-4 text-left space-y-2 text-sm">
          <p className="font-semibold text-primary">What happens next:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>Admin reviews your NID and selfie</li>
            <li>You're notified when approved or rejected</li>
            <li>Once approved, you can log in and operate</li>
          </ol>
        </div>
        <Link to="/login" className="btn-primary block">Back to Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 to-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold text-primary">SafePay</div>
          <div className="text-gray-500 mt-1">Agent Registration</div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-bold text-gray-700">📋 Agent Info</h3>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
              <input className="input-field" placeholder="Your name"
                value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Business Name</label>
              <input className="input-field" placeholder="Shop / business name"
                value={form.business_name} onChange={set('business_name')} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number</label>
              <input className="input-field" type="tel" placeholder="01XXXXXXXXX"
                value={form.phone} onChange={set('phone')} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">PIN (4–6 digits)</label>
              <input className="input-field" type="password" maxLength={6} placeholder="Set PIN"
                value={form.pin} onChange={set('pin')} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Confirm PIN</label>
              <input className="input-field" type="password" maxLength={6} placeholder="Re-enter PIN"
                value={form.confirmPin} onChange={set('confirmPin')} required />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h3 className="font-bold text-gray-700 mb-1">🪪 Identity Verification (KYC)</h3>
              <p className="text-xs text-gray-400 mb-4">
                Required. Admin reviews these documents before approving your account.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FileUploadBox
                  label="NID Front"
                  hint="Front of National ID"
                  onChange={setFile('nid_front')}
                  preview={previews.nid_front}
                />
                <FileUploadBox
                  label="NID Back"
                  hint="Back of National ID"
                  onChange={setFile('nid_back')}
                  preview={previews.nid_back}
                />
              </div>
              <div className="mt-3">
                <FileUploadBox
                  label="Selfie (Face Photo)"
                  hint="Clear face photo — no sunglasses"
                  onChange={setFile('selfie')}
                  preview={previews.selfie}
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              ⚠️ Your account will be <strong>activated after admin reviews</strong> your documents.
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : '📤 Submit for Approval'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already registered? <Link to="/login" className="text-primary font-semibold">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
