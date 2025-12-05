// Shared authentication check for protected pages
// This script checks if user is authenticated when page loads

(async function checkPageAuth() {
  const currentPath = window.location.pathname;
  
  // Pages that require authentication
  const protectedPages = ['/subject.html', '/reviewer.html', '/quiz.html'];
  const isProtectedPage = protectedPages.some(page => currentPath.endsWith(page));
  
  if (!isProtectedPage) {
    return; // Not a protected page, allow access
  }
  
  // Check if user is authenticated
  const user = await getCurrentUser();
  
  if (!user) {
    // Not authenticated - redirect to home with message
    sessionStorage.setItem('authRequired', 'true');
    window.location.href = '/index.html';
    return;
  }
  
  // Check if email is verified
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.email_verified) {
    // Email not verified - redirect to home
    sessionStorage.setItem('authRequired', 'true');
    window.location.href = '/index.html';
    return;
  }
  
  // User is authenticated and verified, allow access
  // Update navbar if the page has it
  if (typeof initializeUserNav === 'function') {
    initializeUserNav();
  }
})();
