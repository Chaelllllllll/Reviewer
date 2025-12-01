function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

async function checkAuth() {
  try {
    const response = await fetch('/api/admin/check-auth');
    const data = await response.json();
    if (!data.authenticated) {
      window.location.href = '/admin/login.html';
    }
  } catch (error) {
    window.location.href = '/admin/login.html';
  }
}

async function loadSubjects() {
  try {
    const response = await fetch('/api/subjects');
    const data = await response.json();
    const subjects = data.subjects || [];
    
    const container = document.getElementById('subjectsContainer');
    
    if (subjects.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle-fill me-2"></i>
          No subjects yet. Click "Add New Subject" to get started.
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-striped">
          <thead>
            <tr>
              <th>Subject Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(subject => `
              <tr>
                <td><strong>${escapeHtml(subject.name)}</strong></td>
                <td>${escapeHtml(subject.description || '')}</td>
                <td>
                  <a href="/admin/reviewers.html?id=${subject.id}" class="btn btn-sm btn-primary">
                    <i class="bi bi-eye-fill me-1"></i>View Reviewers
                  </a>
                  <button class="btn btn-sm btn-danger" onclick="deleteSubject(${subject.id}, '${escapeHtml(subject.name)}')">
                    <i class="bi bi-trash-fill me-1"></i>Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error('Error loading subjects:', error);
    document.getElementById('subjectsContainer').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Error loading subjects.
      </div>
    `;
  }
}

async function deleteSubject(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated reviewers.`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/subject/' + id, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      loadSubjects();
    } else {
      alert('Error deleting subject');
    }
  } catch (error) {
    console.error('Error deleting subject:', error);
    alert('Error deleting subject');
  }
}

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/';
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadSubjects();
});
