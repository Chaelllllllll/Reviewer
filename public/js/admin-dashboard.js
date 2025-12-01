let subjectModal;
let deleteModal;
let deleteSubjectId = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  subjectModal = new bootstrap.Modal(document.getElementById('subjectModal'));
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  
  loadSubjects();
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Load all subjects
async function loadSubjects() {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('subjectsTable');
    const noSubjects = document.getElementById('noSubjects');
    const tbody = document.getElementById('subjectsTableBody');

    spinner.style.display = 'none';

    if (!subjects || subjects.length === 0) {
      noSubjects.style.display = 'block';
      return;
    }

    table.style.display = 'block';
    
    tbody.innerHTML = subjects.map(subject => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <div style="width: 20px; height: 20px; background-color: ${subject.color}; border-radius: 5px; margin-right: 10px;"></div>
            <strong>${escapeHtml(subject.title)}</strong>
          </div>
        </td>
        <td>${escapeHtml(subject.description || '-')}</td>
        <td>${new Date(subject.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <div class="btn-group" role="group">
            <a href="/admin/subject-reviewers.html?id=${subject.id}" class="btn btn-sm btn-outline-pink">
              <i class="bi bi-eye"></i> View
            </a>
            <button class="btn btn-sm btn-outline-pink" onclick="editSubject('${subject.id}')">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteSubject('${subject.id}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
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
  document.getElementById('subjectColor').value = '#FFD4E5';
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
    document.getElementById('subjectColor').value = subject.color || '#FFD4E5';
    
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
  const color = document.getElementById('subjectColor').value;

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
        .insert([{ title, description, color }]);

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
