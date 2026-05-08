'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'fc777863-e790-4774-98a5-a6b0af06a59f'

export default function CalcPage() {
  const [loading, setLoading] = useState(true)
  const [initialBalance, setInitialBalance] = useState('')
  const [commissionRate, setCommissionRate] = useState('3')
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ deposit: '', withdrawal: '' })
  const [isSetup, setIsSetup] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const { data: s } = await supabase.from('calc_settings').select('*').eq('company_id', COMPANY_ID).maybeSingle()
      if (s) { setInitialBalance(s.initial_balance.toString()); setCommissionRate(s.commission_rate.toString()); setSettingsId(s.id); setIsSetup(true) }
      const { data: e } = await supabase.from('calc_entries').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: true })
      setEntries(e || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSetup = async () => {
    if (!initialBalance) return alert('Tutar girin!')
    try {
      if (settingsId) { await supabase.from('calc_settings').update({ initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate) }).eq('id', settingsId) }
      else { const { data } = await supabase.from('calc_settings').insert({ company_id: COMPANY_ID, initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate) }).select().single(); if (data) setSettingsId(data.id) }
      setIsSetup(true)
    } catch (err: any) { alert(err.message) }
  }

  const handleAdd = async () => {
    const dep = parseFloat(formData.deposit) || 0, wit = parseFloat(formData.withdrawal) || 0
    if (!dep && !wit) return alert('Tutar girin!')
    const rate = parseFloat(commissionRate) / 100, comm = dep * rate
    const lb = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance)
    const lc = entries.length > 0 ? entries[entries.length - 1].total_commission : 0
    try {
      const { data, error } = await supabase.from('calc_entries').insert({ company_id: COMPANY_ID, deposit: dep, withdrawal: wit, commission: comm, balance_after: lb + dep - wit, total_commission: lc + comm }).select().single()
      if (error) throw error
      setEntries([...entries, data]); setFormData({ deposit: '', withdrawal: '' }); setShowForm(false)
    } catch (err: any) { alert(err.message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return
    await supabase.from('calc_entries').delete().eq('id', id)
    const rem = entries.filter(e => e.id !== id)
    let bal = parseFloat(initialBalance), tc = 0; const r = parseFloat(commissionRate) / 100
    for (const e of rem) { const c = e.deposit * r; bal += e.deposit - e.withdrawal; tc += c; await supabase.from('calc_entries').update({ commission: c, balance_after: bal, total_commission: tc }).eq('id', e.id); e.commission = c; e.balance_after = bal; e.total_commission = tc }
    setEntries([...rem])
  }

  const handleReset = async () => {
    if (!confirm('TÜM verileri silmek istediğinizden emin misiniz?')) return
    await supabase.from('calc_entries').delete().eq('company_id', COMPANY_ID)
    await supabase.from('calc_settings').delete().eq('company_id', COMPANY_ID)
    setEntries([]); setInitialBalance(''); setCommissionRate('3'); setIsSetup(false); setSettingsId(null)
  }

  const cur = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance) || 0
  const tDep = entries.reduce((s: number, e: any) => s + e.deposit, 0)
  const tWit = entries.reduce((s: number, e: any) => s + e.withdrawal, 0)
  const tCom = entries.length > 0 ? entries[entries.length - 1].total_commission : 0
  const last = entries[entries.length - 1]
  const need = isSetup && last && (Date.now() - new Date(last.created_at).getTime()) / 3600000 >= 12
  const f = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const grp: Record<string, any[]> = {}
  entries.forEach((e: any) => { const d = new Date(e.created_at).toLocaleDateString('tr-TR'); if (!grp[d]) grp[d] = []; grp[d].push(e) })

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>

  if (!isSetup) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6"><div className="text-4xl mb-3">🧮</div><h1 className="text-2xl font-bold">Kasa Hesaplama</h1></div>
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold mb-2">Ana Kasa (₺)</label><input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 border-2 rounded-xl text-lg font-mono" /></div>
          <div><label className="block text-sm font-semibold mb-2">Komisyon (%)</label><input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="w-full px-4 py-3 border-2 rounded-xl text-lg font-mono" /></div>
          <button onClick={handleSetup} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-lg">Başla</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">🧮 Kasa Hesaplama</h2><p className="text-sm text-gray-500">%{commissionRate} komisyon • Başlangıç: ₺{f(parseFloat(initialBalance))}</p></div>
        <div className="flex gap-2">
          <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm">+ Yeni Kayıt</button>
          <button onClick={handleReset} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Sıfırla</button>
        </div>
      </div>

      {need && <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex items-center gap-3 animate-pulse"><span className="text-2xl">⏰</span><div className="flex-1"><p className="font-bold text-orange-800">12 saat geçti!</p><p className="text-sm text-orange-600">Son: {new Date(last.created_at).toLocaleString('tr-TR')}</p></div><button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold text-sm">Gir</button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white"><div className="text-xs opacity-80 mb-1">KASA</div><div className="text-2xl font-bold font-mono">₺{f(cur)}</div></div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white"><div className="text-xs opacity-80 mb-1">YATIRIM</div><div className="text-2xl font-bold font-mono">₺{f(tDep)}</div></div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white"><div className="text-xs opacity-80 mb-1">ÇEKİM</div><div className="text-2xl font-bold font-mono">₺{f(tWit)}</div></div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white"><div className="text-xs opacity-80 mb-1">KOMİSYON</div><div className="text-2xl font-bold font-mono">₺{f(tCom)}</div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b font-bold">Kayıtlar ({entries.length})</div>
        {Object.keys(grp).length > 0 ? Object.entries(grp).reverse().map(([date, de]) => (
          <div key={date} className="border-b last:border-0">
            <div className="px-4 py-2 bg-gray-50 flex justify-between text-xs"><span className="font-bold">{date}</span><div className="flex gap-3"><span className="text-green-600">↓₺{f(de.reduce((s:number,e:any)=>s+e.deposit,0))}</span><span className="text-red-600">↑₺{f(de.reduce((s:number,e:any)=>s+e.withdrawal,0))}</span><span className="text-purple-600">K:₺{f(de.reduce((s:number,e:any)=>s+e.commission,0))}</span></div></div>
            {de.map((e:any) => (
              <div key={e.id} className="px-4 py-2 flex justify-between border-t border-gray-100 text-sm hover:bg-blue-50/30">
                <div className="flex gap-3 items-center">
                  <span className="text-xs text-gray-400 font-mono">{new Date(e.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>
                  {e.deposit>0&&<span className="text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full text-xs">+₺{f(e.deposit)}</span>}
                  {e.withdrawal>0&&<span className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full text-xs">-₺{f(e.withdrawal)}</span>}
                  {e.commission>0&&<span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">K:₺{f(e.commission)}</span>}
                </div>
                <div className="flex items-center gap-3"><span className="font-mono font-bold">₺{f(e.balance_after)}</span><button onClick={()=>handleDelete(e.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button></div>
              </div>
            ))}
          </div>
        )) : <div className="text-center py-10 text-gray-400">Henüz kayıt yok</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Yeni Kayıt</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold mb-2">↓ Yatırım (₺)</label><input type="number" step="0.01" value={formData.deposit} onChange={e=>setFormData({...formData,deposit:e.target.value})} placeholder="0.00" className="w-full px-4 py-3 border-2 border-green-200 rounded-xl text-lg font-mono" />{formData.deposit&&parseFloat(formData.deposit)>0&&<p className="text-xs text-purple-600 mt-1 font-semibold">Komisyon: ₺{f(parseFloat(formData.deposit)*parseFloat(commissionRate)/100)}</p>}</div>
              <div><label className="block text-sm font-semibold mb-2">↑ Çekim (₺)</label><input type="number" step="0.01" value={formData.withdrawal} onChange={e=>setFormData({...formData,withdrawal:e.target.value})} placeholder="0.00" className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-lg font-mono" /></div>
              {(formData.deposit||formData.withdrawal)&&<div className="bg-gray-50 rounded-xl p-3 text-sm"><div className="flex justify-between"><span>Mevcut:</span><span className="font-mono font-bold">₺{f(cur)}</span></div><div className="flex justify-between border-t pt-1 mt-1 font-bold text-blue-700"><span>Yeni:</span><span className="font-mono">₺{f(cur+(parseFloat(formData.deposit)||0)-(parseFloat(formData.withdrawal)||0))}</span></div></div>}
              <div className="flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 py-3 border rounded-xl font-semibold">İptal</button><button onClick={handleAdd} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
