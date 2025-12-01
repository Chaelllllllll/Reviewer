const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('id');

let subjectModal;
let deleteModal;
let deleteSubjectId = null;

if (!courseId) {
  window.location.href = '/admin/dashboard.html';
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  subjectModal = new bootstrap.Modal(document.getElementById('subjectModal'));
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  
  loadCourse();
  loadSubjects();
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Load course details
async function loadCourse() {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) throw error;

    if (!course) {
      window.location.href = '/admin/dashboard.html';
      return;
    }

    document.getElementById('courseTitle').textContent = course.title;

  } catch (error) {
    console.error('Error loading course:', error);
    window.location.href = '/admin/dashboard.html';
  }
}

// Load all subjects for this course
async function loadSubjects() {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const spinner = document.getElementById('loadingSpinner');
    const grid = document.getElementById('subjectsGrid');
    const noSubjects = document.getElementById('noSubjects');

    spinner.style.display = 'none';

    if (!subjects || subjects.length === 0) {
      noSubjects.style.display = 'block';
      return;
    }

    grid.style.display = 'flex';
    
    grid.innerHTML = subjects.map(subject => `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100">
          <div class="card-header" style="background-color: ${subject.color || '#fd77ad'};">
            <h5 class="mb-0 text-white">
              <i class="bi bi-book"></i> ${escapeHtml(subject.title)}
            </h5>
          </div>
          <div class="card-body d-flex flex-column">
            <p class="card-text flex-grow-1">${escapeHtml(subject.description || 'No description available.')}</p>
            <div class="d-flex gap-2 mt-3">
              <a href="/admin/subject-reviewers.html?id=${subject.id}" class="btn btn-pink btn-sm flex-grow-1 text-light">
                <i class="bi bi-eye"></i> View Reviewers
              </a>
              <button class="btn btn-outline-pink btn-sm" onclick="editSubject('${subject.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="deleteSubject('${subject.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading subjects:', error);
    alert('Failed to load subjects. Please refresh the page.');
  }
}

// Show create subject modal
function showCreateSubjectModal() {
  document.getElementById('subjectModalTitle').textContent = 'Create Subject';
  document.getElementById('subjectForm').reset();
  document.getElementById('subjectId').value = '';
  subjectModal.show();
}

// Edit subject
async function editSubject(id) {
  try {
    const { data: subject, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
    document.getElementById('subjectId').value = subject.id;
    document.getElementById('subjectTitle').value = subject.title;
    document.getElementById('subjectDescription').value = subject.description || '';
    
    subjectModal.show();

  } catch (error) {
    console.error('Error loading subject:', error);
    alert('Failed to load subject details.');
  }
}

// Save subject (create or update)
async function saveSubject() {
  const id = document.getElementById('subjectId').value;
  const title = document.getElementById('subjectTitle').value.trim();
  const description = document.getElementById('subjectDescription').value.trim();
  const color = '#fd77ad';

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    if (id) {
      // Update
      const { error } = await supabase
        .from('subjects')
        .update({ title, description, color, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } else {
      // Create
      const { error } = await supabase
        .from('subjects')
        .insert([{ title, description, color, course_id: courseId }]);

      if (error) throw error;
    }

    subjectModal.hide();
    loadSubjects();

  } catch (error) {
    console.error('Error saving subject:', error);
    alert('Failed to save subject. Please try again.');
  }
}

// Delete subject
function deleteSubject(id) {
  deleteSubjectId = id;
  deleteModal.show();
}

// Confirm delete
async function confirmDelete() {
  if (!deleteSubjectId) return;

  try {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', deleteSubjectId);

    if (error) throw error;

    deleteModal.hide();
    deleteSubjectId = null;
    loadSubjects();

  } catch (error) {
    console.error('Error deleting subject:', error);
    alert('Failed to delete subject. Please try again.');
  }
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
