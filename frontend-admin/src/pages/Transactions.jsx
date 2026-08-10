import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function Transactions() {
  const [txns, setTxns] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/transactions?page=${page}&per_page=25`)
      .then(r => {
        setTxns(r.data.transactions)
        setPages(r.data.pages)
        setTotal(r.data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const TYPE_COLOR = {
    transfer: 'badge-blue',
    cash_in: 'badge-green',
    cash_out: 'bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full',
    request: 'badge-yellow',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Transactions</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">From</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">To</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Flags</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No transactions</td></tr>
            ) : txns.map(tx => (
              <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 mono text-gray-400 text-xs">#{tx.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{tx.sender_name}</div>
                  <div className="text-xs text-gray-400 capitalize">{tx.sender_type}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{tx.receiver_name}</div>
                  <div className="text-xs text-gray-400 capitalize">{tx.receiver_type}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={TYPE_COLOR[tx.tx_type] || 'badge-blue'}>{tx.tx_type}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold mono text-primary">৳{tx.amount}</td>
                <td className="px-4 py-3 text-center">
                  {tx.anomaly_flagged && (
                    <span className="badge-red">⚠️ Flagged</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  )
}
