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

async function loadSubjectReviewers() {
  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get('id');
  
  if (!subjectId) {
    window.location.href = '/';
    return;
  }
  
  try {
    const response = await fetch('/api/subject/' + subjectId);
    const data = await response.json();
    
    if (!data.subject) {
      window.location.href = '/';
      return;
    }
    
    const subject = data.subject;
    const reviewers = data.reviewers || [];
    
    // Update breadcrumb
    document.getElementById('breadcrumb').innerHTML = `
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item active" aria-current="page">${escapeHtml(subject.name)}</li>
        </ol>
      </nav>
    `;
    
    // Update title
    document.getElementById('subjectTitle').innerHTML = `
      <i class="bi bi-journal-bookmark-fill me-2" style="color: var(--dark-pink);"></i>
      ${escapeHtml(subject.name)} - Reviewers
    `;
    
    // Update reviewers
    const container = document.getElementById('reviewersContainer');
    
    if (reviewers.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle-fill me-2"></i>
          No reviewers available for this subject yet.
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="row row-cols-1 row-cols-md-2 g-4">
        ${reviewers.map(reviewer => `
          <div class="col">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title">
                  <i class="bi bi-file-earmark-text me-2"></i>
                  ${escapeHtml(reviewer.title)}
                </h5>
                <p class="card-text">
                  ${escapeHtml((reviewer.content || '').substring(0, 150))}${(reviewer.content || '').length > 150 ? '...' : ''}
                </p>
                <a href="/reviewer.html?id=${reviewer.id}" class="btn btn-primary">
                  <i class="bi bi-eye-fill me-2"></i>View Details
                </a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error loading reviewers:', error);
    document.getElementById('reviewersContainer').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Error loading reviewers. Please try again later.
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', loadSubjectReviewers);
