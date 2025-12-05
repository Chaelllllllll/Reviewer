// Profile page functionality

let currentProfile = null;

// Require authentication
requireAuth().then(async (isAuth) => {
  if (!isAuth) return;
  await loadProfile();
});

// Load user profile
async function loadProfile() {
  try {
    const user = await getCurrentUser();
    currentProfile = await getCurrentUserProfile();
    
    if (!currentProfile || !user) {
      throw new Error('Profile not found');
    }
    
    const userEmail = user.email;
    
    // Update UI
    const profilePic = currentProfile.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile.username || userEmail)}&size=150`;
    
    document.getElementById('profilePicture').src = profilePic;
    document.getElementById('profileName').textContent = currentProfile.username || 'User';
    document.getElementById('profileEmail').textContent = userEmail;
    document.getElementById('username').value = currentProfile.username || '';
    document.getElementById('email').value = userEmail;
    
  } catch (error) {
    console.error('Load profile error:', error);
    showError('Failed to load profile');
  }
}

// Toggle password visibility
function setupPasswordToggles() {
  const toggles = [
    { btn: 'toggleCurrentPassword', input: 'currentPassword' },
    { btn: 'toggleNewPassword', input: 'newPassword' }
  ];
  
  toggles.forEach(({ btn, input }) => {
    document.getElementById(btn)?.addEventListener('click', function() {
      const passwordInput = document.getElementById(input);
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
  });
}

setupPasswordToggles();

// Handle profile picture upload
document.getElementById('profilePictureInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showError('Image must be less than 2MB');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showError('Please select an image file');
    return;
  }
  
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;
    
    const { data, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);
    
    // Update profile in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: publicUrl })
      .eq('id', user.id);
    
    if (updateError) throw updateError;
    
    // Update UI
    document.getElementById('profilePicture').src = publicUrl;
    showSuccess('Profile picture updated successfully!');
    
  } catch (error) {
    console.error('Upload error:', error);
    showError(error.message || 'Failed to upload profile picture');
  }
});

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const saveProfileBtnText = document.getElementById('saveProfileBtnText');
  const saveProfileSpinner = document.getElementById('saveProfileSpinner');
  
  if (!username) {
    showError('Username is required');
    return;
  }
  
  saveProfileBtn.disabled = true;
  saveProfileBtnText.classList.add('d-none');
  saveProfileSpinner.classList.remove('d-none');
  
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('profiles')
      .update({ username: username })
      .eq('id', user.id);
    
    if (error) throw error;
    
    document.getElementById('profileName').textContent = username;
    showSuccess('Profile updated successfully!');
    
  } catch (error) {
    console.error('Update profile error:', error);
    showError(error.message || 'Failed to update profile');
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtnText.classList.remove('d-none');
    saveProfileSpinner.classList.add('d-none');
  }
});

// Handle password change
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordBtnText = document.getElementById('changePasswordBtnText');
  const changePasswordSpinner = document.getElementById('changePasswordSpinner');
  
  // Validate
  if (newPassword.length < 8) {
    showError('New password must be at least 8 characters');
    return;
  }
  
  if (newPassword !== confirmNewPassword) {
    showError('New passwords do not match');
    return;
  }
  
  if (currentPassword === newPassword) {
    showError('New password must be different from current password');
    return;
  }
  
  changePasswordBtn.disabled = true;
  changePasswordBtnText.classList.add('d-none');
  changePasswordSpinner.classList.remove('d-none');
  
  try {
    // Verify current password by attempting to sign in
    const email = currentProfile.email;
    const { error: signInError } = await signIn(email, currentPassword);
    
    if (signInError) {
      throw new Error('Current password is incorrect');
    }
    
    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (updateError) throw updateError;
    
    // Clear form
    document.getElementById('passwordForm').reset();
    
    showSuccess('Password changed successfully!');
    
  } catch (error) {
    console.error('Password change error:', error);
    showError(error.message || 'Failed to change password');
  } finally {
    changePasswordBtn.disabled = false;
    changePasswordBtnText.classList.remove('d-none');
    changePasswordSpinner.classList.add('d-none');
  }
});

function showError(message) {
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.textContent = message;
  errorAlert.classList.remove('d-none');
  
  const successAlert = document.getElementById('successAlert');
  successAlert.classList.add('d-none');
  
  // Scroll to alert
  errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
  const successAlert = document.getElementById('successAlert');
  successAlert.textContent = message;
  successAlert.classList.remove('d-none');
  
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.classList.add('d-none');
  
  // Scroll to alert
  successAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
