const SUPABASE_URL = 'https://mhcbvuwegwcugsytphrx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oY2J2dXdlZ3djdWdzeXRwaHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NjQ5NjUsImV4cCI6MjA4MDA0MDk2NX0.oBwxhAW0RF_nawnY6KB3TTIXQlW-IfrqH0hkKuegw0I'; // ⚠️ REPLACE WITH ANON KEY

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
  
  // Admin pages check
  if (window.location.pathname.includes('/admin/') && !window.location.pathname.includes('/admin/login.html')) {
    if (!user) {
      window.location.href = '/admin/login.html';
      return false;
    }
    
    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (!profile || !profile.is_admin) {
      // Not an admin - sign out and redirect
      await signOut();
      alert('Access denied. This area is restricted to administrators only.');
      window.location.href = '/admin/login.html';
      return false;
    }
  }
  
  return true;
}

// Check if user is authenticated for main app (not admin pages)
async function requireAuth() {
  const user = await getCurrentUser();
  const currentPath = window.location.pathname;
  
  // Public pages that don't require auth
  const publicPages = ['/index.html', '/forgot-password.html', '/admin/login.html'];
  const isPublicPage = publicPages.some(page => currentPath.endsWith(page)) || currentPath === '/';
  
  if (!user && !isPublicPage) {
    // Not authenticated and not on a public page - redirect to login
    window.location.href = '/index.html';
    return false;
  }
  
  if (user && !isPublicPage) {
    // Check if email is verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();
    
    if (!profile || !profile.email_verified) {
      // Email not verified - sign out and redirect
      await signOut();
      alert('Please verify your email before accessing the app.');
      window.location.href = '/index.html';
      return false;
    }
  }
  
  return true;
}

// Get current user profile
async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('Profile error:', error);
    return null;
  }
  
  return profile;
}
