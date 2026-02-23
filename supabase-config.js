/* supabase-config.js */
// ==========================================
// ⚠️ REPLACE THESE WITH YOUR SUPABASE PROJECT CREDENTIALS
// Found at: https://supabase.com/dashboard → Project Settings → API
// ==========================================

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
