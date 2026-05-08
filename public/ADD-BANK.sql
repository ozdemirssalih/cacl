-- Banka kasası tablosu
CREATE TABLE IF NOT EXISTS calc_bank_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  initial_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calc_bank_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_type VARCHAR(20) NOT NULL, -- 'commission_in', 'expense'
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  balance_after DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calc_bank_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calc_bank_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_s_sel" ON calc_bank_settings FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_s_ins" ON calc_bank_settings FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_s_upd" ON calc_bank_settings FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_s_del" ON calc_bank_settings FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bank_e_sel" ON calc_bank_entries FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_e_ins" ON calc_bank_entries FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_e_del" ON calc_bank_entries FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "bank_e_upd" ON calc_bank_entries FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

SELECT 'Banka tabloları oluşturuldu!' as mesaj;
