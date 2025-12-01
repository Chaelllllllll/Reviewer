// Supabase client configuration
const SUPABASE_URL = 'https://mhcbvuwegwcugsytphrx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oY2J2dXdlZ3djdWdzeXRwaHJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ2NDk2NSwiZXhwIjoyMDgwMDQwOTY1fQ.tQJQqnmLEYWIqS8zQZhfEwi8h6S4SDSlBeOwR7LwtHQ';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth helpers
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Check if user is authenticated
async function checkAuth() {
  const user = await getCurrentUser();
  if (!user && window.location.pathname.includes('/admin/') && !window.location.pathname.includes('/admin/login.html')) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}
