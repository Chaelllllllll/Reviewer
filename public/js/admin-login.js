// Check if already logged in
async function checkIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = '/admin/dashboard.html';
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  const errorDiv = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  
  // Disable button and show loading
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Signing in...';
  errorDiv.style.display = 'none';
  
  try {
    const { data, error } = await signIn(email, password);
    
    if (error) throw error;
    
    // Success - redirect to dashboard
    window.location.href = '/admin/dashboard.html';
    
  } catch (error) {
    console.error('Login error:', error);
    
    errorText.textContent = error.message || 'Invalid email or password. Please try again.';
    errorDiv.style.display = 'block';
    
    // Re-enable button
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Sign In';
  }
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', checkIfLoggedIn);
