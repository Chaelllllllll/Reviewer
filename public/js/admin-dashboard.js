let courseModal;
let deleteModal;
let deleteCourseId = null;
let profileModal;
let currentUser = null;
let uploadedAvatarFile = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  courseModal = new bootstrap.Modal(document.getElementById('courseModal'));
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
  
  loadCourses();
  loadUserProfile();
  
  // Load profile when modal is opened
  document.getElementById('profileModal').addEventListener('show.bs.modal', loadUserProfile);
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Load all courses with subject counts
async function loadCourses() {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        *,
        subjects (count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('coursesTable');
    const noCourses = document.getElementById('noCourses');
    const tbody = document.getElementById('coursesTableBody');

    spinner.style.display = 'none';

    if (!courses || courses.length === 0) {
      noCourses.style.display = 'block';
      return;
    }

    table.style.display = 'block';
    
    tbody.innerHTML = courses.map(course => {
      const subjectCount = course.subjects?.[0]?.count || 0;
      
      return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
              <div style="width: 20px; height: 20px; background-color: ${course.color || '#fd77ad'}; border-radius: 5px; margin-right: 10px;"></div>
            <strong>${escapeHtml(course.title)}</strong>
          </div>
        </td>
        <td>${escapeHtml(course.description || '-')}</td>
        <td><span class="badge bg-pink text-dark">${subjectCount} subject${subjectCount !== 1 ? 's' : ''}</span></td>
        <td>${new Date(course.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <div class="btn-group" role="group">
            <a href="/admin/course-subjects.html?id=${course.id}" class="btn btn-sm btn-outline-pink">
              <i class="bi bi-eye"></i> View Subjects
            </a>
            <button class="btn btn-sm btn-outline-pink" onclick="editCourse('${course.id}')">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCourse('${course.id}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `}).join('');

  } catch (error) {
    console.error('Error loading courses:', error);
    alert('Failed to load courses. Please refresh the page.');
  }
}

// Show create course modal
function showCreateCourseModal() {
  document.getElementById('courseModalTitle').textContent = 'Create Course';
  document.getElementById('courseForm').reset();
  document.getElementById('courseId').value = '';
  courseModal.show();
}

// Edit course
async function editCourse(id) {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseTitle').value = course.title;
    document.getElementById('courseDescription').value = course.description || '';
    
    courseModal.show();

  } catch (error) {
    console.error('Error loading course:', error);
    alert('Failed to load course details.');
  }
}

// Save course (create or update)
async function saveCourse() {
  const id = document.getElementById('courseId').value;
  const title = document.getElementById('courseTitle').value.trim();
  const description = document.getElementById('courseDescription').value.trim();
  const color = '#fd77ad';

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    if (id) {
      // Update
      const { error } = await supabase
        .from('courses')
        .update({ title, description, color, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } else {
      // Create
      const { error } = await supabase
        .from('courses')
        .insert([{ title, description, color }]);

      if (error) throw error;
    }

    courseModal.hide();
    loadCourses();

  } catch (error) {
    console.error('Error saving course:', error);
    alert('Failed to save course. Please try again.');
  }
}

// Delete course
function deleteCourse(id) {
  deleteCourseId = id;
  deleteModal.show();
}

// Confirm delete
async function confirmDelete() {
  if (!deleteCourseId) return;

  try {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', deleteCourseId);

    if (error) throw error;

    deleteModal.hide();
    deleteCourseId = null;
    loadCourses();

  } catch (error) {
    console.error('Error deleting course:', error);
    alert('Failed to delete course. Please try again.');
  }
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Profile Management Functions

// Load user profile
async function loadUserProfile() {
  try {
    currentUser = await getCurrentUser();
    if (!currentUser) return;

    // Display email
    const emailDisplay = document.getElementById('emailDisplay');
    if (emailDisplay) {
      emailDisplay.value = currentUser.email;
    }

    // Load profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
      return;
    }

    if (profile) {
      // Set username
      const usernameInput = document.getElementById('usernameInput');
      if (usernameInput) {
        usernameInput.value = profile.username || '';
      }

      // Set avatar
      const avatarPreview = document.getElementById('avatarPreview');
      if (profile.avatar_url && avatarPreview) {
        avatarPreview.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--pink-primary);">`;
      }
    } else {
      // Create profile if doesn't exist
      const defaultUsername = currentUser.email.split('@')[0];
      const usernameInput = document.getElementById('usernameInput');
      if (usernameInput) {
        usernameInput.value = defaultUsername;
      }
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Handle avatar upload
async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file
  if (!file.type.startsWith('image/')) {
    showProfileAlert('Please select an image file', 'danger');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showProfileAlert('Image size must be less than 2MB', 'danger');
    return;
  }

  // Preview image
  const reader = new FileReader();
  reader.onload = (e) => {
    const avatarPreview = document.getElementById('avatarPreview');
    if (avatarPreview) {
      avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Avatar" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--pink-primary);">`;
    }
  };
  reader.readAsDataURL(file);

  // Store file for upload
  uploadedAvatarFile = file;
}

// Save profile
async function saveProfile() {
  try {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!username) {
      showProfileAlert('Username is required', 'warning');
      return;
    }

    if (username.length < 3) {
      showProfileAlert('Username must be at least 3 characters', 'warning');
      return;
    }

    // Show loading
    const saveBtn = document.querySelector('#profileModal .btn-pink');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    let avatarUrl = null;

    // Upload avatar if a new one was selected
    if (uploadedAvatarFile) {
      const fileExt = uploadedAvatarFile.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, uploadedAvatarFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        showProfileAlert('Failed to upload avatar', 'danger');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      avatarUrl = urlData.publicUrl;
    }

    // Update or insert profile
    const profileData = {
      id: currentUser.id,
      username: username,
      updated_at: new Date().toISOString()
    };

    if (avatarUrl) {
      profileData.avatar_url = avatarUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(profileData);

    if (error) throw error;

    // Reset upload file
    uploadedAvatarFile = null;

    // Show success
    showProfileAlert('Profile updated successfully!', 'success');
    
    // Reset button
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;

    // Close modal after 1 second
    setTimeout(() => {
      profileModal.hide();
      // Reload messages if admin messages are open
      if (typeof loadAdminMessages === 'function') {
        loadAdminMessages();
      }
    }, 1000);

  } catch (error) {
    console.error('Error saving profile:', error);
    showProfileAlert('Failed to save profile. Please try again.', 'danger');
    
    const saveBtn = document.querySelector('#profileModal .btn-pink');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Save Changes';
  }
}

// Show profile alert
function showProfileAlert(message, type = 'info') {
  const container = document.getElementById('profileAlertContainer');
  if (!container) return;

  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  container.innerHTML = '';
  container.appendChild(alert);

  if (type === 'success') {
    setTimeout(() => {
      alert.remove();
    }, 3000);
  }
}
