'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const CID = 'fc777863-e790-4774-98a5-a6b0af06a59f'
const f = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CalcPage() {
  const [loading, setLoading] = useState(true)
  const [initialBalance, setInitialBalance] = useState('')
  const [commissionRate, setCommissionRate] = useState('3')
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ deposit: '', withdrawal: '' })
  const [isSetup, setIsSetup] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())

  // Banka
  const [bankBalance, setBankBalance] = useState(0)
  const [bankInitial, setBankInitial] = useState('')
  const [bankEntries, setBankEntries] = useState<any[]>([])
  const [bankSetup, setBankSetup] = useState(false)
  const [bankSettingsId, setBankSettingsId] = useState<string | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '' })

  // Tab
  const [tab, setTab] = useState<'main' | 'bank'>('main')

  useEffect(() => { init() }, [])
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const init = async () => {
    try {
      const { data: s } = await supabase.from('calc_settings').select('*').eq('company_id', CID).maybeSingle()
      if (s) { setInitialBalance(s.initial_balance.toString()); setCommissionRate(s.commission_rate.toString()); setSettingsId(s.id); setIsSetup(true) }
      const { data: e } = await supabase.from('calc_entries').select('*').eq('company_id', CID).order('created_at', { ascending: true })
      setEntries(e || [])

      // Banka
      const { data: bs } = await supabase.from('calc_bank_settings').select('*').eq('company_id', CID).maybeSingle()
      if (bs) { setBankInitial(bs.initial_balance.toString()); setBankSettingsId(bs.id); setBankSetup(true) }
      const { data: be } = await supabase.from('calc_bank_entries').select('*').eq('company_id', CID).order('created_at', { ascending: true })
      setBankEntries(be || [])
      if (be && be.length > 0) setBankBalance(be[be.length - 1].balance_after)
      else if (bs) setBankBalance(bs.initial_balance)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // Ana kasa setup
  const handleSetup = async () => {
    if (!initialBalance) return alert('Tutar girin!')
    try {
      if (settingsId) { await supabase.from('calc_settings').update({ initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate) }).eq('id', settingsId) }
      else { const { data } = await supabase.from('calc_settings').insert({ company_id: CID, initial_balance: parseFloat(initialBalance), commission_rate: parseFloat(commissionRate) }).select().single(); if (data) setSettingsId(data.id) }
      setIsSetup(true)
    } catch (err: any) { alert(err.message) }
  }

  // Banka setup
  const handleBankSetup = async () => {
    if (!bankInitial) return alert('Banka bakiyesi girin!')
    try {
      if (bankSettingsId) { await supabase.from('calc_bank_settings').update({ initial_balance: parseFloat(bankInitial) }).eq('id', bankSettingsId) }
      else { const { data } = await supabase.from('calc_bank_settings').insert({ company_id: CID, initial_balance: parseFloat(bankInitial) }).select().single(); if (data) setBankSettingsId(data.id) }
      setBankBalance(parseFloat(bankInitial)); setBankSetup(true)
    } catch (err: any) { alert(err.message) }
  }

  // Ana kasa kayıt ekle + komisyon bankaya aktar
  const handleAdd = async () => {
    const dep = parseFloat(formData.deposit) || 0, wit = parseFloat(formData.withdrawal) || 0
    if (!dep && !wit) return alert('Tutar girin!')
    const rate = parseFloat(commissionRate) / 100, comm = dep * rate
    const lb = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance)
    const lc = entries.length > 0 ? entries[entries.length - 1].total_commission : 0
    try {
      const { data, error } = await supabase.from('calc_entries').insert({ company_id: CID, deposit: dep, withdrawal: wit, commission: comm, balance_after: lb + dep - wit, total_commission: lc + comm }).select().single()
      if (error) throw error
      setEntries([...entries, data])

      // Komisyon bankaya aktar
      if (comm > 0 && bankSetup) {
        const newBankBal = bankBalance + comm
        const { data: bankData } = await supabase.from('calc_bank_entries').insert({ company_id: CID, entry_type: 'commission_in', amount: comm, description: `Komisyon: ₺${f(dep)} yatırımdan %${commissionRate}`, balance_after: newBankBal }).select().single()
        if (bankData) { setBankEntries([...bankEntries, bankData]); setBankBalance(newBankBal) }
      }

      setFormData({ deposit: '', withdrawal: '' }); setShowForm(false)
    } catch (err: any) { alert(err.message) }
  }

  // Banka gider ekle
  const handleAddExpense = async () => {
    const amt = parseFloat(expenseForm.amount) || 0
    if (!amt || !expenseForm.description.trim()) return alert('Tutar ve açıklama girin!')
    if (amt > bankBalance) return alert('Yetersiz bakiye!')
    try {
      const newBal = bankBalance - amt
      const { data, error } = await supabase.from('calc_bank_entries').insert({ company_id: CID, entry_type: 'expense', amount: amt, description: expenseForm.description.trim(), balance_after: newBal }).select().single()
      if (error) throw error
      setBankEntries([...bankEntries, data]); setBankBalance(newBal)
      setExpenseForm({ amount: '', description: '' }); setShowExpenseForm(false)
    } catch (err: any) { alert(err.message) }
  }

  // Silme
  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return
    await supabase.from('calc_entries').delete().eq('id', id)
    const rem = entries.filter(e => e.id !== id)
    let bal = parseFloat(initialBalance), tc = 0; const r = parseFloat(commissionRate) / 100
    for (const e of rem) { const c = e.deposit * r; bal += e.deposit - e.withdrawal; tc += c; await supabase.from('calc_entries').update({ commission: c, balance_after: bal, total_commission: tc }).eq('id', e.id); e.commission = c; e.balance_after = bal; e.total_commission = tc }
    setEntries([...rem])
  }

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return
    await supabase.from('calc_bank_entries').delete().eq('id', id)
    const rem = bankEntries.filter(e => e.id !== id)
    let bal = parseFloat(bankInitial)
    for (const e of rem) { bal = e.entry_type === 'commission_in' ? bal + e.amount : bal - e.amount; await supabase.from('calc_bank_entries').update({ balance_after: bal }).eq('id', e.id); e.balance_after = bal }
    setBankEntries([...rem]); setBankBalance(rem.length > 0 ? rem[rem.length - 1].balance_after : parseFloat(bankInitial))
  }

  const handleReset = async () => {
    if (!confirm('TÜM verileri silmek istediğinizden emin misiniz?')) return
    await supabase.from('calc_entries').delete().eq('company_id', CID)
    await supabase.from('calc_settings').delete().eq('company_id', CID)
    await supabase.from('calc_bank_entries').delete().eq('company_id', CID)
    await supabase.from('calc_bank_settings').delete().eq('company_id', CID)
    setEntries([]); setInitialBalance(''); setCommissionRate('3'); setIsSetup(false); setSettingsId(null)
    setBankEntries([]); setBankInitial(''); setBankSetup(false); setBankSettingsId(null); setBankBalance(0)
  }

  const cur = entries.length > 0 ? entries[entries.length - 1].balance_after : parseFloat(initialBalance) || 0
  const tDep = entries.reduce((s: number, e: any) => s + e.deposit, 0)
  const tWit = entries.reduce((s: number, e: any) => s + e.withdrawal, 0)
  const tCom = entries.length > 0 ? entries[entries.length - 1].total_commission : 0
  const last = entries[entries.length - 1]
  const need = isSetup && last && (Date.now() - new Date(last.created_at).getTime()) / 3600000 >= 12
  const totalBankExpenses = bankEntries.filter(e => e.entry_type === 'expense').reduce((s: number, e: any) => s + e.amount, 0)
  const totalBankCommissions = bankEntries.filter(e => e.entry_type === 'commission_in').reduce((s: number, e: any) => s + e.amount, 0)

  const grp: Record<string, any[]> = {}
  entries.forEach((e: any) => { const d = new Date(e.created_at).toLocaleDateString('tr-TR'); if (!grp[d]) grp[d] = []; grp[d].push(e) })

  const bankGrp: Record<string, any[]> = {}
  bankEntries.forEach((e: any) => { const d = new Date(e.created_at).toLocaleDateString('tr-TR'); if (!bankGrp[d]) bankGrp[d] = []; bankGrp[d].push(e) })

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div></div>

  if (!isSetup) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30"><span className="text-3xl">💰</span></div>
          <h1 className="text-3xl font-bold text-white">Kasa Takip</h1>
          <p className="text-blue-300/70 mt-2 text-sm">Başlangıç değerlerini girin</p>
        </div>
        <div className="space-y-5">
          <div><label className="block text-sm font-medium text-blue-200 mb-2">Ana Kasa (₺)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">₺</span><input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
          <div><label className="block text-sm font-medium text-blue-200 mb-2">Komisyon (%)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">%</span><input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
          <div><label className="block text-sm font-medium text-blue-200 mb-2">Banka Kasası Başlangıç (₺)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold">₺</span><input type="number" step="0.01" value={bankInitial} onChange={e => setBankInitial(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-amber-500 outline-none" /></div></div>
          <button onClick={async () => { await handleSetup(); if (bankInitial) await handleBankSetup() }} className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]">Başla →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"><span className="text-lg">💰</span></div>
            <div><h1 className="font-bold text-lg">Kasa Takip</h1><p className="text-xs text-blue-300/50">%{commissionRate} komisyon</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-2 hidden md:block">
              <div className="text-xl font-mono font-bold text-blue-300">{time.toLocaleTimeString('tr-TR')}</div>
              <div className="text-xs text-blue-400/50">{time.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
            <button onClick={handleReset} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/60">↺</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-2">
          <button onClick={() => setTab('main')} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'main' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>💰 Ana Kasa</button>
          <button onClick={() => setTab('bank')} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'bank' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>🏦 Banka</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ═══ ANA KASA ═══ */}
        {tab === 'main' && (<>
          {need && <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 flex items-center gap-4"><div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-2xl animate-bounce">⏰</span></div><div className="flex-1"><p className="font-bold text-orange-300">12 saat geçti!</p><p className="text-sm text-orange-400/60">Son: {new Date(last.created_at).toLocaleString('tr-TR')}</p></div><button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 rounded-xl font-semibold text-sm">Gir</button></div>}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 group hover:border-blue-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-blue-400/60 uppercase tracking-wider mb-1">Ana Kasa</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-blue-300 to-blue-100 bg-clip-text text-transparent">₺{f(cur)}</div></div></div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 group hover:border-emerald-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-emerald-400/60 uppercase tracking-wider mb-1">Yatırım</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">₺{f(tDep)}</div></div></div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 group hover:border-rose-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-rose-400/60 uppercase tracking-wider mb-1">Çekim</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-rose-300 to-rose-100 bg-clip-text text-transparent">₺{f(tWit)}</div></div></div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 group hover:border-violet-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-violet-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-violet-400/60 uppercase tracking-wider mb-1">Komisyon</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-violet-300 to-violet-100 bg-clip-text text-transparent">₺{f(tCom)}</div></div></div>
          </div>

          <div className="flex justify-end"><button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all">+ Yeni Kayıt</button></div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex justify-between"><h3 className="font-bold text-white/90">Ana Kasa Kayıtları</h3><span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">{entries.length}</span></div>
            {Object.keys(grp).length > 0 ? Object.entries(grp).reverse().map(([date, de]) => (
              <div key={date} className="border-b border-white/5 last:border-0">
                <div className="px-5 py-3 bg-white/[0.02] flex justify-between"><span className="font-semibold text-sm text-white/70">{date}</span><div className="flex gap-4 text-xs"><span className="text-emerald-400">↓₺{f(de.reduce((s:number,e:any)=>s+e.deposit,0))}</span><span className="text-rose-400">↑₺{f(de.reduce((s:number,e:any)=>s+e.withdrawal,0))}</span><span className="text-violet-400">K:₺{f(de.reduce((s:number,e:any)=>s+e.commission,0))}</span></div></div>
                {de.map((e:any) => (
                  <div key={e.id} className="px-5 py-3 flex justify-between items-center border-t border-white/[0.03] hover:bg-white/[0.02] group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/20 font-mono w-12">{new Date(e.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>
                      {e.deposit>0&&<span className="text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-lg text-sm border border-emerald-500/20">+₺{f(e.deposit)}</span>}
                      {e.withdrawal>0&&<span className="text-rose-400 font-semibold bg-rose-500/10 px-3 py-1 rounded-lg text-sm border border-rose-500/20">-₺{f(e.withdrawal)}</span>}
                      {e.commission>0&&<span className="text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded text-[11px] border border-violet-500/20">K:₺{f(e.commission)}</span>}
                    </div>
                    <div className="flex items-center gap-4"><span className="font-mono font-bold text-white/90">₺{f(e.balance_after)}</span><button onClick={()=>handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-white/20 hover:text-rose-400 transition-all">✕</button></div>
                  </div>
                ))}
              </div>
            )) : <div className="text-center py-16 text-white/20">Henüz kayıt yok</div>}
          </div>
        </>)}

        {/* ═══ BANKA ═══ */}
        {tab === 'bank' && (<>
          {!bankSetup ? (
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
              <div className="text-center mb-6"><span className="text-4xl">🏦</span><h3 className="text-xl font-bold mt-3">Banka Kasası</h3><p className="text-sm text-white/40 mt-1">Başlangıç bakiyesini girin</p></div>
              <div className="relative mb-4"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold">₺</span><input type="number" step="0.01" value={bankInitial} onChange={e => setBankInitial(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-amber-500 outline-none" /></div>
              <button onClick={handleBankSetup} className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl font-bold shadow-lg shadow-amber-600/30">Oluştur</button>
            </div>
          ) : (<>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-amber-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-amber-400/60 uppercase tracking-wider mb-1">Banka Bakiye</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-amber-300 to-amber-100 bg-clip-text text-transparent">₺{f(bankBalance)}</div></div></div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-violet-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-violet-400/60 uppercase tracking-wider mb-1">Gelen Komisyon</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-violet-300 to-violet-100 bg-clip-text text-transparent">₺{f(totalBankCommissions)}</div></div></div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-rose-500/30 transition-all relative overflow-hidden"><div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full"></div><div className="relative"><div className="text-xs text-rose-400/60 uppercase tracking-wider mb-1">Toplam Gider</div><div className="text-3xl font-bold font-mono bg-gradient-to-r from-rose-300 to-rose-100 bg-clip-text text-transparent">₺{f(totalBankExpenses)}</div></div></div>
            </div>

            <div className="flex justify-end"><button onClick={() => { setShowExpenseForm(true); setExpenseForm({ amount: '', description: '' }) }} className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 rounded-xl font-semibold text-sm shadow-lg shadow-amber-600/20 transition-all">+ Gider Ekle</button></div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex justify-between"><h3 className="font-bold text-white/90">Banka Hareketleri</h3><span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">{bankEntries.length}</span></div>
              {Object.keys(bankGrp).length > 0 ? Object.entries(bankGrp).reverse().map(([date, de]) => (
                <div key={date} className="border-b border-white/5 last:border-0">
                  <div className="px-5 py-3 bg-white/[0.02] flex justify-between"><span className="font-semibold text-sm text-white/70">{date}</span></div>
                  {de.map((e:any) => (
                    <div key={e.id} className="px-5 py-3 flex justify-between items-center border-t border-white/[0.03] hover:bg-white/[0.02] group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/20 font-mono w-12">{new Date(e.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>
                        {e.entry_type === 'commission_in' ? (
                          <span className="text-violet-400 font-semibold bg-violet-500/10 px-3 py-1 rounded-lg text-sm border border-violet-500/20">+₺{f(e.amount)}</span>
                        ) : (
                          <span className="text-rose-400 font-semibold bg-rose-500/10 px-3 py-1 rounded-lg text-sm border border-rose-500/20">-₺{f(e.amount)}</span>
                        )}
                        <span className="text-xs text-white/40 truncate max-w-[200px]">{e.description}</span>
                      </div>
                      <div className="flex items-center gap-4"><span className="font-mono font-bold text-white/90">₺{f(e.balance_after)}</span><button onClick={()=>handleDeleteBank(e.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-white/20 hover:text-rose-400 transition-all">✕</button></div>
                    </div>
                  ))}
                </div>
              )) : <div className="text-center py-16 text-white/20">Henüz hareket yok</div>}
            </div>
          </>)}
        </>)}
      </div>

      {/* Ana kasa modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowForm(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-6"><h3 className="text-xl font-bold">Yeni Kayıt</h3><button onClick={()=>setShowForm(false)} className="p-2 hover:bg-white/10 rounded-xl text-white/40">✕</button></div>
            <div className="space-y-5">
              <div><label className="block text-sm font-medium text-emerald-300/70 mb-2">↓ Yatırım</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">₺</span><input type="number" step="0.01" value={formData.deposit} onChange={e=>setFormData({...formData,deposit:e.target.value})} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xl font-mono text-white placeholder-white/15 focus:ring-2 focus:ring-emerald-500 outline-none" /></div>{formData.deposit&&parseFloat(formData.deposit)>0&&<p className="text-xs text-violet-400 mt-2 ml-1">Komisyon: ₺{f(parseFloat(formData.deposit)*parseFloat(commissionRate)/100)} → Bankaya aktarılacak</p>}</div>
              <div><label className="block text-sm font-medium text-rose-300/70 mb-2">↑ Çekim</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-bold">₺</span><input type="number" step="0.01" value={formData.withdrawal} onChange={e=>setFormData({...formData,withdrawal:e.target.value})} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-xl font-mono text-white placeholder-white/15 focus:ring-2 focus:ring-rose-500 outline-none" /></div></div>
              {(formData.deposit||formData.withdrawal)&&<div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/5"><div className="flex justify-between text-sm"><span className="text-white/40">Mevcut</span><span className="font-mono font-bold text-white/80">₺{f(cur)}</span></div><div className="flex justify-between text-sm border-t border-white/5 pt-2"><span className="text-blue-400">Yeni bakiye</span><span className="font-mono font-bold text-blue-300 text-lg">₺{f(cur+(parseFloat(formData.deposit)||0)-(parseFloat(formData.withdrawal)||0))}</span></div></div>}
              <div className="flex gap-3 pt-2"><button onClick={()=>setShowForm(false)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-white/70">İptal</button><button onClick={handleAdd} className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-[0.98]">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Gider modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowExpenseForm(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-6"><h3 className="text-xl font-bold">🏦 Banka Gideri</h3><button onClick={()=>setShowExpenseForm(false)} className="p-2 hover:bg-white/10 rounded-xl text-white/40">✕</button></div>
            <div className="space-y-5">
              <div><label className="block text-sm font-medium text-rose-300/70 mb-2">Tutar</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-bold">₺</span><input type="number" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-xl font-mono text-white placeholder-white/15 focus:ring-2 focus:ring-rose-500 outline-none" /></div></div>
              <div><label className="block text-sm font-medium text-white/50 mb-2">Açıklama</label><input type="text" value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} placeholder="Yemek, içecek, vb." className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-amber-500 outline-none" /></div>
              <div className="flex flex-wrap gap-2">
                {['Yemek','İçecek','Market','Akaryakıt','Ulaşım','Kırtasiye','Diğer'].map(r => (
                  <button key={r} onClick={()=>setExpenseForm({...expenseForm,description:r})} className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${expenseForm.description===r?'bg-amber-600 text-white border-amber-600':'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}>{r}</button>
                ))}
              </div>
              {expenseForm.amount&&<div className="bg-white/5 rounded-2xl p-3 text-sm border border-white/5"><div className="flex justify-between"><span className="text-white/40">Banka bakiye</span><span className="font-mono font-bold">₺{f(bankBalance)}</span></div><div className="flex justify-between border-t border-white/5 pt-2 mt-2"><span className="text-amber-400">Kalan</span><span className="font-mono font-bold text-amber-300">₺{f(bankBalance-(parseFloat(expenseForm.amount)||0))}</span></div></div>}
              <div className="flex gap-3 pt-2"><button onClick={()=>setShowExpenseForm(false)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-white/70">İptal</button><button onClick={handleAddExpense} className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl font-bold shadow-lg shadow-amber-600/20 active:scale-[0.98]">Harcama Ekle</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
