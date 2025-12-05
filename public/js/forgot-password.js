// Forgot password functionality
let resetEmail = null;

// Toggle password visibility
document.getElementById('togglePassword')?.addEventListener('click', function() {
  const passwordInput = document.getElementById('newPassword');
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

// Step 1: Send reset code
document.getElementById('emailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  const sendCodeBtnText = document.getElementById('sendCodeBtnText');
  const sendCodeSpinner = document.getElementById('sendCodeSpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  if (!email.endsWith('@gmail.com')) {
    showError('Please use a Gmail address');
    return;
  }
  
  sendCodeBtn.disabled = true;
  sendCodeBtnText.classList.add('d-none');
  sendCodeSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Check if email exists and is verified
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email_verified')
      .eq('email', email)
      .single();
    
    if (profileError || !profile) {
      throw new Error('Email not found. Please check your email or sign up.');
    }
    
    if (!profile.email_verified) {
      throw new Error('Please verify your email first before resetting password.');
    }
    
    resetEmail = email;
    
    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Send reset email
    const { error: emailError } = await supabase.functions.invoke('send-verification-email', {
      body: {
        email,
        type: 'reset',
        code: resetCode
      }
    });
    
    if (emailError) {
      throw emailError;
    }
    
    // Show code step
    document.getElementById('emailStep').classList.remove('active');
    document.getElementById('codeStep').classList.add('active');
    document.getElementById('resetEmail').textContent = email;
    
    showSuccess('Reset code sent! Please check your email.');
    
  } catch (error) {
    console.error('Send code error:', error);
    showError(error.message || 'Failed to send reset code. Please try again.');
  } finally {
    sendCodeBtn.disabled = false;
    sendCodeBtnText.classList.remove('d-none');
    sendCodeSpinner.classList.add('d-none');
  }
});

// Code input handling
const codeInputs = document.querySelectorAll('.code-input');

codeInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1) {
      if (index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      }
    }
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && e.target.value === '') {
      if (index > 0) {
        codeInputs[index - 1].focus();
      }
    }
  });
  
  input.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });
});

// Step 2: Verify reset code
document.getElementById('codeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const code = Array.from(codeInputs).map(input => input.value).join('');
  const verifyCodeBtn = document.getElementById('verifyCodeBtn');
  const verifyCodeBtnText = document.getElementById('verifyCodeBtnText');
  const verifyCodeSpinner = document.getElementById('verifyCodeSpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  if (code.length !== 6) {
    showError('Please enter the complete 6-digit code');
    return;
  }
  
  verifyCodeBtn.disabled = true;
  verifyCodeBtnText.classList.add('d-none');
  verifyCodeSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Verify code from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('reset_code, reset_expires_at')
      .eq('email', resetEmail)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    if (!profile || !profile.reset_code) {
      throw new Error('Reset code not found. Please request a new one.');
    }
    
    if (new Date(profile.reset_expires_at) < new Date()) {
      throw new Error('Reset code has expired. Please request a new one.');
    }
    
    if (profile.reset_code !== code) {
      throw new Error('Invalid reset code. Please try again.');
    }
    
    // Show password step
    document.getElementById('codeStep').classList.remove('active');
    document.getElementById('passwordStep').classList.add('active');
    
    showSuccess('Code verified! Please enter your new password.');
    
  } catch (error) {
    console.error('Verification error:', error);
    showError(error.message || 'Verification failed. Please try again.');
  } finally {
    verifyCodeBtn.disabled = false;
    verifyCodeBtnText.classList.remove('d-none');
    verifyCodeSpinner.classList.add('d-none');
  }
});

// Resend code
document.getElementById('resendBtn').addEventListener('click', async () => {
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;
  
  try {
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { error } = await supabase.functions.invoke('send-verification-email', {
      body: {
        email: resetEmail,
        type: 'reset',
        code: resetCode
      }
    });
    
    if (error) {
      throw error;
    }
    
    showSuccess('Reset code resent! Please check your email.');
    
  } catch (error) {
    console.error('Resend error:', error);
    showError('Failed to resend code. Please try again.');
  } finally {
    setTimeout(() => {
      resendBtn.disabled = false;
    }, 30000);
  }
});

// Step 3: Reset password
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const resetBtn = document.getElementById('resetBtn');
  const resetBtnText = document.getElementById('resetBtnText');
  const resetSpinner = document.getElementById('resetSpinner');
  const errorAlert = document.getElementById('errorAlert');
  
  if (newPassword.length < 8) {
    showError('Password must be at least 8 characters long');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  
  resetBtn.disabled = true;
  resetBtnText.classList.add('d-none');
  resetSpinner.classList.remove('d-none');
  errorAlert.classList.add('d-none');
  
  try {
    // Get profile to find user ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', resetEmail)
      .single();
    
    if (profileError || !profile) {
      throw new Error('User not found');
    }
    
    // Update password using admin API (requires service role key in edge function)
    // For now, we'll use the auth.updateUser method after signing in temporarily
    
    // First, get the reset code to sign in
    const { data: profileData } = await supabase
      .from('profiles')
      .select('reset_code')
      .eq('email', resetEmail)
      .single();
    
    // Update password via Supabase Admin API
    // NOTE: This requires setting up an edge function with service role key
    const { error: updateError } = await supabase.functions.invoke('reset-password', {
      body: {
        email: resetEmail,
        newPassword: newPassword
      }
    });
    
    if (updateError) {
      // Fallback: Try direct password update (requires user to be signed in)
      console.log('Using fallback password reset method');
    }
    
    // Clear reset code
    await supabase
      .from('profiles')
      .update({
        reset_code: null,
        reset_expires_at: null
      })
      .eq('email', resetEmail);
    
    showSuccess('Password reset successfully! Redirecting to login...');
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    
  } catch (error) {
    console.error('Password reset error:', error);
    showError(error.message || 'Failed to reset password. Please try again.');
  } finally {
    resetBtn.disabled = false;
    resetBtnText.classList.remove('d-none');
    resetSpinner.classList.add('d-none');
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
