-- RLS'i kapat (public erişim)
ALTER TABLE calc_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE calc_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE calc_bank_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE calc_bank_entries DISABLE ROW LEVEL SECURITY;
SELECT 'RLS kapatıldı!' as mesaj;
