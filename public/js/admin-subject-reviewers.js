const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');
let deleteModal;
let deleteReviewerId = null;

if (!subjectId) {
  window.location.href = '/admin/dashboard.html';
}

// Check authentication and load data
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  
  // Update create button link
  document.getElementById('createReviewerBtn').href = `/admin/reviewer-editor.html?subject_id=${subjectId}`;
  
  loadSubject();
  loadReviewers();
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Load subject details
async function loadSubject() {
  try {
    const { data: subject, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single();

    if (error) throw error;

    const header = document.getElementById('subjectHeader');
    header.innerHTML = `
      <div class="d-flex align-items-center">
        <div style="width: 40px; height: 40px; background-color: ${subject.color}; border-radius: 10px; margin-right: 15px;"></div>
        <div>
          <h2 class="text-pink mb-1 fw-bold">${escapeHtml(subject.title)}</h2>
          <p class="text-muted mb-0">${escapeHtml(subject.description || '')}</p>
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Error loading subject:', error);
    window.location.href = '/admin/dashboard.html';
  }
}

// Load reviewers
async function loadReviewers() {
  try {
    const { data: reviewers, error } = await supabase
      .from('reviewers')
      .select('*')
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('reviewersTable');
    const noReviewers = document.getElementById('noReviewers');
    const tbody = document.getElementById('reviewersTableBody');

    spinner.style.display = 'none';

    if (!reviewers || reviewers.length === 0) {
      noReviewers.style.display = 'block';
      return;
    }

    table.style.display = 'block';
    
    tbody.innerHTML = reviewers.map((reviewer, index) => `
      <tr>
        <td>
          <div class="badge badge-pink text-light">${index + 1}</div>
        </td>
        <td><strong>${escapeHtml(reviewer.title)}</strong></td>
        <td>${new Date(reviewer.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <div class="btn-group" role="group">
            <a href="/reviewer.html?id=${reviewer.id}" target="_blank" class="btn btn-sm btn-outline-pink">
              <i class="bi bi-eye"></i> View
            </a>
            <a href="/admin/reviewer-editor.html?id=${reviewer.id}" class="btn btn-sm btn-outline-pink">
              <i class="bi bi-pencil"></i> Edit
            </a>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteReviewer('${reviewer.id}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error loading reviewers:', error);
    alert('Failed to load reviewers. Please refresh the page.');
  }
}

// Delete reviewer
function deleteReviewer(id) {
  deleteReviewerId = id;
  deleteModal.show();
}

// Confirm delete
async function confirmDelete() {
  if (!deleteReviewerId) return;

  try {
    const { error } = await supabase
      .from('reviewers')
      .delete()
      .eq('id', deleteReviewerId);

    if (error) throw error;

    deleteModal.hide();
    deleteReviewerId = null;
    loadReviewers();

  } catch (error) {
    console.error('Error deleting reviewer:', error);
    alert('Failed to delete reviewer. Please try again.');
  }
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
