import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function TransactionHistory() {
  const [txns, setTxns] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/transactions/history?page=${page}&per_page=15`)
      .then(r => { setTxns(r.data.transactions); setPages(r.data.pages); setTotal(r.data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const typeLabel = { transfer: 'Transfer', cash_in: 'Cash In', cash_out: 'Cash Out', request: 'Request' }
  const typeColor = { transfer: 'bg-blue-50 text-blue-600', cash_in: 'bg-primary-light text-primary-dark',
    cash_out: 'bg-purple-50 text-purple-600', request: 'bg-yellow-50 text-yellow-600' }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : txns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No transactions yet</div>
        ) : (
          txns.map((tx, i) => (
            <div key={tx.id} className={`flex items-center gap-4 px-5 py-4 ${i !== txns.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0
                ${tx.direction === 'out' ? 'bg-red-50' : 'bg-primary-light'}`}>
                {tx.direction === 'out' ? '↗' : '↙'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {tx.direction === 'out' ? `To ${tx.receiver_name}` : `From ${tx.sender_name}`}
                </div>
                <div className="text-xs text-gray-400 mono">{tx.direction === 'out' ? tx.receiver_phone : tx.sender_phone}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[tx.tx_type] || 'bg-gray-100 text-gray-600'}`}>
                    {typeLabel[tx.tx_type] || tx.tx_type}
                  </span>
                  {tx.anomaly_flagged && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">⚠️ Flagged</span>}
                  {tx.note && <span className="text-xs text-gray-400 truncate">"{tx.note}"</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-bold mono text-sm ${tx.direction === 'out' ? 'text-red-500' : 'text-primary'}`}>
                  {tx.direction === 'out' ? '-' : '+'}৳{tx.amount}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  )
}
