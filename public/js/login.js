// Login functionality

// Check if already logged in
async function checkIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    // Check if email is verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();
    
    if (profile && profile.email_verified) {
      window.location.href = 'index.html';
    }
  }
}

checkIfLoggedIn();

// Toggle password visibility
document.getElementById('togglePassword').addEventListener('click', function() {
  const passwordInput = document.getElementById('password');
  const icon = this.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('bi-eye');
    icon.classList.add('bi-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('bi-eye-slash');
    icon.classList.add('bi-eye');
  }
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  // Validate Gmail
  if (!email.endsWith('@gmail.com')) {
    showError('Please use a Gmail address');
    return;
  }
  
  // Disable button and show spinner
  loginBtn.disabled = true;
  loginBtnText.classList.add('d-none');
  loginSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Sign in with Supabase
    const { data, error } = await signIn(email, password);
    
    if (error) {
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Login failed. Please try again.');
    }
    
    // Check if email is verified
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) {
      console.error('Profile error:', profileError);
    }
    
    if (!profile || !profile.email_verified) {
      // Email not verified, redirect to verification
      await signOut();
      showError('Please verify your email first. Check your inbox for the verification code.');
      return;
    }
    
    // Success - redirect to home
    window.location.href = 'index.html';
    
  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || 'Invalid email or password');
  } finally {
    loginBtn.disabled = false;
    loginBtnText.classList.remove('d-none');
    loginSpinner.classList.add('d-none');
  }
});

function showError(message) {
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.textContent = message;
  errorAlert.classList.remove('d-none');
}
