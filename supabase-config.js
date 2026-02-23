/* supabase-config.js */
// ==========================================
// Supabase Project Credentials
// Found at: https://supabase.com/dashboard → Project Settings → API
// ==========================================

const SUPABASE_URL = 'https://gloejpacnqxvxcmgtiwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsb2VqcGFjbnF4dnhjbWd0aXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTEyOTcsImV4cCI6MjA4NzQyNzI5N30._hkRBxjXGrEv-Wruj97UpPQtQLm43qSuwWEZL0F-aaE';

// Initialize Supabase client
// The UMD build exposes window.supabase as a namespace containing createClient
// We store the client in a new global variable 'sb' to avoid naming conflict
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client initialized:', !!sb);
console.log('Auth module available:', !!sb.auth);
