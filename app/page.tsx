'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'fc777863-e790-4774-98a5-a6b0af06a59f'
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

  useEffect(() => { init() }, [])
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

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
  const hoursSince = last ? (Date.now() - new Date(last.created_at).getTime()) / 3600000 : 999
  const need = isSetup && entries.length > 0 && hoursSince >= 12

  const grp: Record<string, any[]> = {}
  entries.forEach((e: any) => { const d = new Date(e.created_at).toLocaleDateString('tr-TR'); if (!grp[d]) grp[d] = []; grp[d].push(e) })

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div>
    </div>
  )

  if (!isSetup) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Kasa Takip</h1>
          <p className="text-blue-300/70 mt-2 text-sm">Başlangıç değerlerini girin</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Ana Kasa Tutarı</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">₺</span>
              <input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)}
                placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Komisyon Oranı</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">%</span>
              <input type="number" step="0.1" value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xl font-mono text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <button onClick={handleSetup} className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]">
            Başla →
          </button>
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-lg">💰</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Kasa Takip</h1>
              <p className="text-xs text-blue-300/50">%{commissionRate} komisyon</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-2 hidden md:block">
              <div className="text-2xl font-mono font-bold text-blue-300">{time.toLocaleTimeString('tr-TR')}</div>
              <div className="text-xs text-blue-400/50">{time.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
            <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-[0.97]">
              + Yeni Kayıt
            </button>
            <button onClick={handleReset} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/60 transition-all">
              ↺
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 12 saat uyarısı */}
        {need && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl animate-bounce">⏰</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-orange-300">12 saat geçti — Veri girişi gerekiyor!</p>
              <p className="text-sm text-orange-400/60">Son: {new Date(last.created_at).toLocaleString('tr-TR')}</p>
            </div>
            <button onClick={() => { setShowForm(true); setFormData({ deposit: '', withdrawal: '' }) }}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 rounded-xl font-semibold text-sm transition-all">Gir</button>
          </div>
        )}

        {/* Kartlar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-all"></div>
            <div className="relative">
              <div className="text-xs text-blue-400/60 font-medium mb-1 uppercase tracking-wider">Ana Kasa</div>
              <div className="text-3xl font-bold font-mono bg-gradient-to-r from-blue-300 to-blue-100 bg-clip-text text-transparent">₺{f(cur)}</div>
              <div className="text-xs text-blue-400/40 mt-2">Güncel bakiye</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="relative">
              <div className="text-xs text-emerald-400/60 font-medium mb-1 uppercase tracking-wider">Toplam Yatırım</div>
              <div className="text-3xl font-bold font-mono bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">₺{f(tDep)}</div>
              <div className="text-xs text-emerald-400/40 mt-2">{entries.filter(e => e.deposit > 0).length} işlem</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-rose-500/30 transition-all">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full group-hover:bg-rose-500/20 transition-all"></div>
            <div className="relative">
              <div className="text-xs text-rose-400/60 font-medium mb-1 uppercase tracking-wider">Toplam Çekim</div>
              <div className="text-3xl font-bold font-mono bg-gradient-to-r from-rose-300 to-rose-100 bg-clip-text text-transparent">₺{f(tWit)}</div>
              <div className="text-xs text-rose-400/40 mt-2">{entries.filter(e => e.withdrawal > 0).length} işlem</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-violet-500/30 transition-all">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-violet-500/10 rounded-full group-hover:bg-violet-500/20 transition-all"></div>
            <div className="relative">
              <div className="text-xs text-violet-400/60 font-medium mb-1 uppercase tracking-wider">Komisyon</div>
              <div className="text-3xl font-bold font-mono bg-gradient-to-r from-violet-300 to-violet-100 bg-clip-text text-transparent">₺{f(tCom)}</div>
              <div className="text-xs text-violet-400/40 mt-2">%{commissionRate} oran</div>
            </div>
          </div>
        </div>

        {/* Kayıtlar */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white/90">Kayıt Geçmişi</h3>
            <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">{entries.length} kayıt</span>
          </div>

          {Object.keys(grp).length > 0 ? Object.entries(grp).reverse().map(([date, de]) => (
            <div key={date} className="border-b border-white/5 last:border-0">
              <div className="px-5 py-3 bg-white/[0.02] flex justify-between items-center">
                <span className="font-semibold text-sm text-white/70">{date}</span>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-400">↓ ₺{f(de.reduce((s:number,e:any) => s + e.deposit, 0))}</span>
                  <span className="text-rose-400">↑ ₺{f(de.reduce((s:number,e:any) => s + e.withdrawal, 0))}</span>
                  <span className="text-violet-400">K: ₺{f(de.reduce((s:number,e:any) => s + e.commission, 0))}</span>
                </div>
              </div>
              {de.map((e: any) => (
                <div key={e.id} className="px-5 py-3 flex justify-between items-center border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/20 font-mono w-12">{new Date(e.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {e.deposit > 0 && (
                      <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-lg text-sm border border-emerald-500/20">
                        +₺{f(e.deposit)}
                      </span>
                    )}
                    {e.withdrawal > 0 && (
                      <span className="text-rose-400 font-semibold bg-rose-500/10 px-3 py-1 rounded-lg text-sm border border-rose-500/20">
                        -₺{f(e.withdrawal)}
                      </span>
                    )}
                    {e.commission > 0 && (
                      <span className="text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded text-[11px] font-medium border border-violet-500/20">
                        K: ₺{f(e.commission)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono font-bold text-white/90">₺{f(e.balance_after)}</div>
                      <div className="text-[10px] text-white/20">bakiye</div>
                    </div>
                    <button onClick={() => handleDelete(e.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-white/20 hover:text-rose-400 transition-all">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-3 opacity-30">📊</div>
              <p className="text-white/30">Henüz kayıt yok</p>
              <p className="text-white/15 text-sm mt-1">Yeni kayıt ekleyerek başlayın</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Yeni Kayıt</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-emerald-300/70 mb-2">↓ Yatırım</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">₺</span>
                  <input type="number" step="0.01" value={formData.deposit} onChange={e => setFormData({ ...formData, deposit: e.target.value })}
                    placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xl font-mono text-white placeholder-white/15 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                </div>
                {formData.deposit && parseFloat(formData.deposit) > 0 && (
                  <p className="text-xs text-violet-400 mt-2 ml-1 font-medium">Komisyon: ₺{f(parseFloat(formData.deposit) * parseFloat(commissionRate) / 100)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-rose-300/70 mb-2">↑ Çekim</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-bold">₺</span>
                  <input type="number" step="0.01" value={formData.withdrawal} onChange={e => setFormData({ ...formData, withdrawal: e.target.value })}
                    placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-xl font-mono text-white placeholder-white/15 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none" />
                </div>
              </div>
              {(formData.deposit || formData.withdrawal) && (
                <div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/5">
                  <div className="flex justify-between text-sm"><span className="text-white/40">Mevcut</span><span className="font-mono font-bold text-white/80">₺{f(cur)}</span></div>
                  <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                    <span className="text-blue-400 font-medium">Yeni bakiye</span>
                    <span className="font-mono font-bold text-blue-300 text-lg">₺{f(cur + (parseFloat(formData.deposit) || 0) - (parseFloat(formData.withdrawal) || 0))}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-white/70 transition-all">İptal</button>
                <button onClick={handleAdd} className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
