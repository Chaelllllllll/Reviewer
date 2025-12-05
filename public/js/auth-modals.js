// Modal Login and Signup functionality

let currentUserId = null;
let currentEmail = null;

// ========== LOGIN MODAL ==========

// Toggle password visibility for login
document.getElementById('toggleLoginPassword')?.addEventListener('click', function() {
  const passwordInput = document.getElementById('loginPassword');
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
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const errorAlert = document.getElementById('loginErrorAlert');
  
  // Validate Gmail
  if (!email.endsWith('@gmail.com')) {
    showLoginError('Please use a Gmail address');
    return;
  }
  
  loginBtn.disabled = true;
  loginBtnText.classList.add('d-none');
  loginSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    const { data, error } = await signIn(email, password);
    
    if (error) throw error;
    if (!data.user) throw new Error('Login failed. Please try again.');
    
    // Check if email is verified
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) console.error('Profile error:', profileError);
    
    if (!profile || !profile.email_verified) {
      await signOut();
      showLoginError('Please verify your email first. Check your inbox for the verification code.');
      return;
    }
    
    // Success - reload page to update UI
    window.location.reload();
    
  } catch (error) {
    console.error('Login error:', error);
    showLoginError(error.message || 'Invalid email or password');
  } finally {
    loginBtn.disabled = false;
    loginBtnText.classList.remove('d-none');
    loginSpinner.classList.add('d-none');
  }
});

function showLoginError(message) {
  const errorAlert = document.getElementById('loginErrorAlert');
  errorAlert.textContent = message;
  errorAlert.classList.remove('d-none');
}

// ========== SIGNUP MODAL ==========

// Toggle password visibility for signup
document.getElementById('toggleSignupPassword')?.addEventListener('click', function() {
  const passwordInput = document.getElementById('signupPassword');
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

// Password strength validation
const signupPassword = document.getElementById('signupPassword');
const requirements = {
  length: document.getElementById('lengthReq'),
  uppercase: document.getElementById('uppercaseReq'),
  lowercase: document.getElementById('lowercaseReq'),
  number: document.getElementById('numberReq')
};

signupPassword?.addEventListener('input', () => {
  const value = signupPassword.value;
  
  updateRequirement(requirements.length, value.length >= 8);
  updateRequirement(requirements.uppercase, /[A-Z]/.test(value));
  updateRequirement(requirements.lowercase, /[a-z]/.test(value));
  updateRequirement(requirements.number, /[0-9]/.test(value));
});

function updateRequirement(element, isValid) {
  const icon = element.querySelector('i');
  if (isValid) {
    element.classList.add('text-success');
    element.classList.remove('text-muted');
    icon.classList.remove('bi-circle');
    icon.classList.add('bi-check-circle-fill');
  } else {
    element.classList.remove('text-success');
    element.classList.add('text-muted');
    icon.classList.remove('bi-check-circle-fill');
    icon.classList.add('bi-circle');
  }
}

// Handle signup form submission
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const displayName = document.getElementById('displayName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const signupBtn = document.getElementById('signupBtn');
  const signupBtnText = document.getElementById('signupBtnText');
  const signupSpinner = document.getElementById('signupSpinner');
  
  // Validate
  if (!email.endsWith('@gmail.com')) {
    showSignupError('Please use a Gmail address');
    return;
  }
  
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    showSignupError('Password does not meet requirements');
    return;
  }
  
  if (password !== confirmPassword) {
    showSignupError('Passwords do not match');
    return;
  }
  
  signupBtn.disabled = true;
  signupBtnText.classList.add('d-none');
  signupSpinner.classList.remove('d-none');
  
  try {
    // Sign up without sending Supabase confirmation email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin + '/index.html'
      }
    },
    {
      emailRedirectTo: false // Disable automatic confirmation email
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('Account creation failed. Please try again.');
    
    currentUserId = data.user.id;
    currentEmail = email;
    
    // Create profile
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: email,
      display_name: displayName,
      email_verified: false
    });
    
    // Generate and send verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await supabase.functions.invoke('send-verification-email', {
      body: {
        email,
        type: 'verification',
        code: verificationCode,
        userId: data.user.id
      }
    });
    
    // Show verification step
    document.getElementById('signupStep').classList.add('d-none');
    document.getElementById('verificationStep').classList.remove('d-none');
    document.getElementById('verificationEmail').textContent = email;
    
    showSignupSuccess('Account created! Please check your email for the verification code.');
    
  } catch (error) {
    console.error('Signup error:', error);
    showSignupError(error.message || 'Failed to create account. Please try again.');
  } finally {
    signupBtn.disabled = false;
    signupBtnText.classList.remove('d-none');
    signupSpinner.classList.add('d-none');
  }
});

// Code input handling
const codeInputs = document.querySelectorAll('.code-input');

codeInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1 && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
      codeInputs[index - 1].focus();
    }
  });
  
  input.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });
});

// Handle verification
document.getElementById('verificationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const code = Array.from(codeInputs).map(input => input.value).join('');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifyBtnText = document.getElementById('verifyBtnText');
  const verifySpinner = document.getElementById('verifySpinner');
  
  if (code.length !== 6) {
    showSignupError('Please enter the complete 6-digit code');
    return;
  }
  
  verifyBtn.disabled = true;
  verifyBtnText.classList.add('d-none');
  verifySpinner.classList.remove('d-none');
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('verification_code, verification_expires_at')
      .eq('id', currentUserId)
      .single();
    
    if (error || !profile || !profile.verification_code) {
      throw new Error('Verification code not found. Please request a new one.');
    }
    
    if (new Date(profile.verification_expires_at) < new Date()) {
      throw new Error('Verification code has expired. Please request a new one.');
    }
    
    if (profile.verification_code !== code) {
      throw new Error('Invalid verification code. Please try again.');
    }
    
    // Mark as verified
    await supabase.from('profiles').update({
      email_verified: true,
      verification_code: null,
      verification_expires_at: null
    }).eq('id', currentUserId);
    
    showSignupSuccess('Email verified successfully! Redirecting...');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('Verification error:', error);
    showSignupError(error.message || 'Verification failed. Please try again.');
  } finally {
    verifyBtn.disabled = false;
    verifyBtnText.classList.remove('d-none');
    verifySpinner.classList.add('d-none');
  }
});

// Resend code
document.getElementById('resendBtn')?.addEventListener('click', async () => {
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;
  
  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await supabase.functions.invoke('send-verification-email', {
      body: {
        email: currentEmail,
        type: 'verification',
        code: verificationCode,
        userId: currentUserId
      }
    });
    
    showSignupSuccess('Verification code resent! Please check your email.');
    
  } catch (error) {
    console.error('Resend error:', error);
    showSignupError('Failed to resend code. Please try again.');
  } finally {
    setTimeout(() => {
      resendBtn.disabled = false;
    }, 30000);
  }
});

function showSignupError(message) {
  const errorAlert = document.getElementById('signupErrorAlert');
  errorAlert.textContent = message;
  errorAlert.classList.remove('d-none');
  document.getElementById('signupSuccessAlert').classList.add('d-none');
}

function showSignupSuccess(message) {
  const successAlert = document.getElementById('signupSuccessAlert');
  successAlert.textContent = message;
  successAlert.classList.remove('d-none');
  document.getElementById('signupErrorAlert').classList.add('d-none');
}
