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

async function loadSearchResults() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') || '';
  
  document.getElementById('searchQuery').innerHTML = query ? 
    `<p>Showing results for: <strong>${escapeHtml(query)}</strong></p>` : 
    '<p>Please enter a search term.</p>';
  
  if (!query) {
    document.getElementById('resultsContainer').innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Please enter a search term.
      </div>
    `;
    return;
  }
  
  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(query));
    const data = await response.json();
    const subjects = data.subjects || [];
    
    const container = document.getElementById('resultsContainer');
    
    if (subjects.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle-fill me-2"></i>
          No results found for "${escapeHtml(query)}".
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <h4 class="mb-3">Subjects (${subjects.length})</h4>
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        ${subjects.map(subject => `
          <div class="col">
            <div class="card h-100">
              <div class="card-header">
                <i class="bi bi-book me-2"></i>${escapeHtml(subject.name)}
              </div>
              <div class="card-body">
                <p class="card-text">
                  ${escapeHtml(subject.description || 'Explore review materials for this subject.')}
                </p>
                <a href="/subject.html?id=${subject.id}" class="btn btn-primary">
                  <i class="bi bi-eye-fill me-2"></i>View Reviewers
                </a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error searching:', error);
    document.getElementById('resultsContainer').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Error performing search. Please try again later.
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', loadSearchResults);
