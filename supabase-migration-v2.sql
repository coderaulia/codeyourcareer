-- CodeYourCareer v2 Migration - Run AFTER supabase-setup.sql

CREATE TABLE IF NOT EXISTS site_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    site_name TEXT DEFAULT 'CodeYourCareer.my.id',
    headline TEXT DEFAULT 'Welcome to CodeYourCareer',
    subheadline TEXT DEFAULT 'Every career has a code — and once you learn to decode it, you can build the future you want.',
    footer_text TEXT DEFAULT '© 2026 CodeYourCareer. All rights reserved.',
    logo_type TEXT DEFAULT 'svg',
    logo_svg TEXT DEFAULT '<svg viewBox="0 0 100 100" fill="none"><rect x="5" y="5" width="90" height="90" rx="20" fill="black"/><path d="M35 30 L25 50 L35 70" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M65 30 L75 50 L65 70" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 65 L50 35 M50 35 L40 45 M50 35 L60 45" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    logo_image_url TEXT,
    logo_emoji TEXT DEFAULT '💻',
    bg_color TEXT DEFAULT '#f8f9fa',
    text_color TEXT DEFAULT '#111111',
    text_secondary TEXT DEFAULT '#555555',
    accent_color TEXT DEFAULT '#000000',
    card_bg TEXT DEFAULT '#ffffff',
    card_border TEXT DEFAULT '#e0e0e0',
    cta_bg TEXT DEFAULT '#111111',
    cta_text TEXT DEFAULT '#ffffff',
    cta_btn_bg TEXT DEFAULT '#ffffff',
    cta_btn_text TEXT DEFAULT '#000000',
    cta_title TEXT DEFAULT 'Ready to debug your career?',
    cta_subtitle TEXT DEFAULT '1:1 Session for Students, Job Seekers & Professionals.',
    cta_button_text TEXT DEFAULT 'Mulai Konsultasi Karir Sekarang!',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'bi-puzzle',
    is_enabled BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO modules (name, slug, description, icon, is_enabled, display_order) VALUES
('Consultation Bookings', 'consultation', 'Allow visitors to book 1:1 sessions.', 'bi-calendar-check', true, 1),
('Testimonials', 'testimonials', 'Display client testimonials and social proof.', 'bi-chat-quote', false, 2),
('Contact Form', 'contact', 'Simple contact form for visitor inquiries.', 'bi-envelope', false, 3),
('Link Analytics', 'analytics', 'Track link clicks to understand your audience.', 'bi-bar-chart-line', false, 4)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS testimonials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, role TEXT, content TEXT NOT NULL,
    rating INT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    is_featured BOOLEAN DEFAULT true, display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS link_clicks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    link_id UUID REFERENCES links(id) ON DELETE CASCADE,
    link_title TEXT, clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "admin_update_settings" ON site_settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "public_read_modules" ON modules FOR SELECT USING (true);
CREATE POLICY "admin_update_modules" ON modules FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "public_read_testimonials" ON testimonials FOR SELECT USING (is_featured = true);
CREATE POLICY "admin_all_testimonials" ON testimonials FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "public_insert_contact" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_all_contact" ON contact_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "public_insert_clicks" ON link_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_read_clicks" ON link_clicks FOR SELECT USING (auth.role() = 'authenticated');

CREATE TRIGGER update_site_settings_ts BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modules_ts BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_testimonials_ts BEFORE UPDATE ON testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
