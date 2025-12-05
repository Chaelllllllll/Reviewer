// Signup functionality
let currentUserId = null;
let currentEmail = null;

// Check if already logged in
async function checkIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
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

// Password strength validation
const password = document.getElementById('password');
const requirements = {
  length: document.getElementById('length'),
  uppercase: document.getElementById('uppercase'),
  lowercase: document.getElementById('lowercase'),
  number: document.getElementById('number')
};

password.addEventListener('input', () => {
  const value = password.value;
  
  // Check length
  if (value.length >= 8) {
    requirements.length.classList.add('valid');
    requirements.length.querySelector('i').classList.remove('bi-circle');
    requirements.length.querySelector('i').classList.add('bi-check-circle-fill');
  } else {
    requirements.length.classList.remove('valid');
    requirements.length.querySelector('i').classList.remove('bi-check-circle-fill');
    requirements.length.querySelector('i').classList.add('bi-circle');
  }
  
  // Check uppercase
  if (/[A-Z]/.test(value)) {
    requirements.uppercase.classList.add('valid');
    requirements.uppercase.querySelector('i').classList.remove('bi-circle');
    requirements.uppercase.querySelector('i').classList.add('bi-check-circle-fill');
  } else {
    requirements.uppercase.classList.remove('valid');
    requirements.uppercase.querySelector('i').classList.remove('bi-check-circle-fill');
    requirements.uppercase.querySelector('i').classList.add('bi-circle');
  }
  
  // Check lowercase
  if (/[a-z]/.test(value)) {
    requirements.lowercase.classList.add('valid');
    requirements.lowercase.querySelector('i').classList.remove('bi-circle');
    requirements.lowercase.querySelector('i').classList.add('bi-check-circle-fill');
  } else {
    requirements.lowercase.classList.remove('valid');
    requirements.lowercase.querySelector('i').classList.remove('bi-check-circle-fill');
    requirements.lowercase.querySelector('i').classList.add('bi-circle');
  }
  
  // Check number
  if (/[0-9]/.test(value)) {
    requirements.number.classList.add('valid');
    requirements.number.querySelector('i').classList.remove('bi-circle');
    requirements.number.querySelector('i').classList.add('bi-check-circle-fill');
  } else {
    requirements.number.classList.remove('valid');
    requirements.number.querySelector('i').classList.remove('bi-check-circle-fill');
    requirements.number.querySelector('i').classList.add('bi-circle');
  }
});

// Handle signup form submission
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const displayName = document.getElementById('displayName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const signupBtn = document.getElementById('signupBtn');
  const signupBtnText = document.getElementById('signupBtnText');
  const signupSpinner = document.getElementById('signupSpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  // Validate Gmail
  if (!email.endsWith('@gmail.com')) {
    showError('Please use a Gmail address');
    return;
  }
  
  // Validate password strength
  if (password.length < 8) {
    showError('Password must be at least 8 characters long');
    return;
  }
  
  if (!/[A-Z]/.test(password)) {
    showError('Password must contain at least one uppercase letter');
    return;
  }
  
  if (!/[a-z]/.test(password)) {
    showError('Password must contain at least one lowercase letter');
    return;
  }
  
  if (!/[0-9]/.test(password)) {
    showError('Password must contain at least one number');
    return;
  }
  
  // Validate password match
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  
  // Disable button and show spinner
  signupBtn.disabled = true;
  signupBtnText.classList.add('d-none');
  signupSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Create account with Supabase (without automatic confirmation email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        },
        emailRedirectTo: window.location.origin + '/index.html'
      }
    },
    {
      emailRedirectTo: false // Disable automatic confirmation email
    });
    
    if (error) {
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Account creation failed. Please try again.');
    }
    
    currentUserId = data.user.id;
    currentEmail = email;
    
    // Create or update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: email,
        display_name: displayName,
        email_verified: false
      });
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
    }
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('Sending verification email...', { email, code: verificationCode });
    
    // Send verification email
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-verification-email', {
      body: {
        email,
        type: 'verification',
        code: verificationCode,
        userId: data.user.id
      }
    });
    
    if (emailError) {
      console.error('Email error:', emailError);
      showError('Account created but failed to send verification email. Please try resending.');
    } else {
      console.log('Email sent successfully:', emailData);
    }
    
    // Show verification step
    document.getElementById('signupStep').classList.remove('active');
    document.getElementById('verificationStep').classList.add('active');
    document.getElementById('verificationEmail').textContent = email;
    
    showSuccess('Account created! Please check your email for the verification code.');
    
  } catch (error) {
    console.error('Signup error:', error);
    showError(error.message || 'Failed to create account. Please try again.');
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
    if (e.target.value.length === 1) {
      // Move to next input
      if (index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      }
    }
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && e.target.value === '') {
      // Move to previous input
      if (index > 0) {
        codeInputs[index - 1].focus();
      }
    }
  });
  
  // Only allow numbers
  input.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });
});

// Handle verification form submission
document.getElementById('verificationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const code = Array.from(codeInputs).map(input => input.value).join('');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifyBtnText = document.getElementById('verifyBtnText');
  const verifySpinner = document.getElementById('verifySpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  if (code.length !== 6) {
    showError('Please enter the complete 6-digit code');
    return;
  }
  
  verifyBtn.disabled = true;
  verifyBtnText.classList.add('d-none');
  verifySpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Verify code from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('verification_code, verification_expires_at')
      .eq('id', currentUserId)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    if (!profile || !profile.verification_code) {
      throw new Error('Verification code not found. Please request a new one.');
    }
    
    // Check if code is expired
    if (new Date(profile.verification_expires_at) < new Date()) {
      throw new Error('Verification code has expired. Please request a new one.');
    }
    
    // Check if code matches
    if (profile.verification_code !== code) {
      throw new Error('Invalid verification code. Please try again.');
    }
    
    // Mark email as verified
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        email_verified: true,
        verification_code: null,
        verification_expires_at: null
      })
      .eq('id', currentUserId);
    
    if (updateError) {
      throw updateError;
    }
    
    showSuccess('Email verified successfully! Redirecting to login...');
    
    // Sign out and redirect to login
    await signOut();
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    
  } catch (error) {
    console.error('Verification error:', error);
    showError(error.message || 'Verification failed. Please try again.');
  } finally {
    verifyBtn.disabled = false;
    verifyBtnText.classList.remove('d-none');
    verifySpinner.classList.add('d-none');
  }
});

// Resend code
document.getElementById('resendBtn').addEventListener('click', async () => {
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;
  
  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { error } = await supabase.functions.invoke('send-verification-email', {
      body: {
        email: currentEmail,
        type: 'verification',
        code: verificationCode,
        userId: currentUserId
      }
    });
    
    if (error) {
      throw error;
    }
    
    showSuccess('Verification code resent! Please check your email.');
    
  } catch (error) {
    console.error('Resend error:', error);
    showError('Failed to resend code. Please try again.');
  } finally {
    setTimeout(() => {
      resendBtn.disabled = false;
    }, 30000); // 30 second cooldown
  }
});

function showError(message) {
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.textContent = message;
  errorAlert.classList.remove('d-none');
  
  const successAlert = document.getElementById('successAlert');
  successAlert.classList.add('d-none');
}

function showSuccess(message) {
  const successAlert = document.getElementById('successAlert');
  successAlert.textContent = message;
  successAlert.classList.remove('d-none');
  
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.classList.add('d-none');
}
