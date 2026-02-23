-- ============================================
-- CodeYourCareer - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. LINKS TABLE (Social links displayed on index.html)
CREATE TABLE IF NOT EXISTS links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT DEFAULT 'bi-link-45deg',          -- Bootstrap icon class
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    link_type TEXT DEFAULT 'external',          -- 'external' | 'internal'
    internal_target TEXT,                       -- for internal navigation (e.g. 'freebies', 'gear')
    style_bg TEXT,                              -- optional background color override
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FREEBIES TABLE
CREATE TABLE IF NOT EXISTS freebies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GEAR TABLE
CREATE TABLE IF NOT EXISTS gear (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    link TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL,
    schedule TIMESTAMPTZ NOT NULL,
    meetlink TEXT,
    status TEXT DEFAULT 'pending',              -- 'pending' | 'confirmed' | 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADMIN USERS TABLE (simple auth)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,                 -- Store hashed password
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE freebies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ policies (for the public-facing website)
CREATE POLICY "Public can read active links" ON links
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read freebies" ON freebies
    FOR SELECT USING (true);

CREATE POLICY "Public can read gear" ON gear
    FOR SELECT USING (true);

-- Public can INSERT bookings (for the consultation form)
CREATE POLICY "Public can insert bookings" ON bookings
    FOR INSERT WITH CHECK (true);

-- AUTHENTICATED (admin) policies - full access
CREATE POLICY "Admin full access links" ON links
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access freebies" ON freebies
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access gear" ON gear
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access bookings" ON bookings
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin read admin_users" ON admin_users
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- SEED DATA: Current links from index.html
-- ============================================

INSERT INTO links (title, url, icon, display_order, link_type) VALUES
('Career Hacks on LinkedIn', 'https://www.linkedin.com/in/auliasatriowibowo/', 'bi-linkedin', 1, 'external'),
('Industry Insights (Instagram)', 'https://www.instagram.com/aulia.satrioo', 'bi-instagram', 2, 'external'),
('Quick Tips & Motivation (TikTok)', 'https://www.tiktok.com/@codeyourcareer', 'bi-tiktok', 3, 'external');

-- Internal navigation links
INSERT INTO links (title, url, icon, display_order, link_type, internal_target, style_bg) VALUES
('Freebies: CV Guide & Templates', '#', 'bi-file-earmark-arrow-down-fill', 4, 'internal', 'freebies', '#f1f3f5'),
('My Tech & WFH Gear', '#', 'bi-bag-heart-fill', 5, 'internal', 'gear', '#f1f3f5');

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_links_updated_at BEFORE UPDATE ON links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_freebies_updated_at BEFORE UPDATE ON freebies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gear_updated_at BEFORE UPDATE ON gear
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
