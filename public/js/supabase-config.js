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
  
  // Profile page is accessible even without username
  const isProfilePage = currentPath.endsWith('/profile.html');
  
  if (!user && !isPublicPage) {
    // Not authenticated and not on a public page - redirect to login
    window.location.href = '/index.html';
    return false;
  }
  
  if (user && !isPublicPage) {
    // Check if email is verified and username is set
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified, username')
      .eq('id', user.id)
      .single();
    
    if (!profile || !profile.email_verified) {
      // Email not verified - sign out and redirect
      await signOut();
      showStylizedAlert('Email Verification Required', 'Please verify your email before accessing the app.', 'warning');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 2000);
      return false;
    }
    
    // Check if username is set (except for profile page)
    if (!isProfilePage && (!profile.username || profile.username.trim() === '')) {
      showStylizedAlert('Profile Setup Required', 'Please set your username in your profile before accessing other features.', 'info');
      setTimeout(() => {
        window.location.href = '/profile.html';
      }, 2000);
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

// Stylized alert function
function showStylizedAlert(title, message, type = 'info') {
  // Remove any existing alert
  const existingAlert = document.getElementById('stylizedAlert');
  if (existingAlert) existingAlert.remove();
  
  // Determine icon and colors based on type
  let icon, bgColor, iconColor;
  switch(type) {
    case 'warning':
      icon = 'bi-exclamation-triangle-fill';
      bgColor = '#FFF3CD';
      iconColor = '#856404';
      break;
    case 'info':
      icon = 'bi-info-circle-fill';
      bgColor = '#D1ECF1';
      iconColor = '#0C5460';
      break;
    case 'error':
      icon = 'bi-x-circle-fill';
      bgColor = '#F8D7DA';
      iconColor = '#721C24';
      break;
    default:
      icon = 'bi-check-circle-fill';
      bgColor = '#D4EDDA';
      iconColor = '#155724';
  }
  
  // Create alert element
  const alertDiv = document.createElement('div');
  alertDiv.id = 'stylizedAlert';
  alertDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    padding: 30px;
    max-width: 400px;
    width: 90%;
    z-index: 99999;
    animation: slideIn 0.3s ease-out;
  `;
  
  alertDiv.innerHTML = `
    <style>
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -60%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }
    </style>
    <div style="text-align: center;">
      <div style="background: ${bgColor}; width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
        <i class="bi ${icon}" style="font-size: 35px; color: ${iconColor};"></i>
      </div>
      <h4 style="color: #333; margin-bottom: 12px; font-weight: 600;">${title}</h4>
      <p style="color: #666; margin-bottom: 0; line-height: 1.6;">${message}</p>
    </div>
  `;
  
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 99998;
    animation: fadeIn 0.3s ease-out;
  `;
  backdrop.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(alertDiv);
}
