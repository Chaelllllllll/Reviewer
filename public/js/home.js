// Fetch and display subjects
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
          No subjects available yet. Please check back later!
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
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
    console.error('Error loading subjects:', error);
    document.getElementById('subjectsContainer').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Error loading subjects. Please try again later.
      </div>
    `;
  }
}

// Typeahead for search
function initSearch() {
  const input = document.getElementById('siteSearch');
  const box = document.getElementById('searchSuggestions');
  const form = document.getElementById('searchForm');
  
  if (!input || !box) return;
  
  let timer = null;
  let lastQ = '';
  
  function clearBox() {
    box.innerHTML = '';
    box.style.display = 'none';
  }
  
  function renderSuggestions(results) {
    box.innerHTML = '';
    if (!results || !results.length) {
      clearBox();
      return;
    }
    
    results.forEach(s => {
      const a = document.createElement('a');
      a.className = 'list-group-item list-group-item-action';
      a.href = '/subject.html?id=' + s.id;
      a.innerHTML = '<strong>' + escapeHtml(s.name || '') + '</strong>' + 
        (s.description ? '<div class="small text-muted">' + 
        escapeHtml(s.description.length > 120 ? s.description.substring(0, 120) + '...' : s.description) + 
        '</div>' : '');
      box.appendChild(a);
    });
    box.style.display = 'block';
  }
  
  async function fetchSuggestions(q) {
    if (!q || q.length < 1) {
      clearBox();
      return;
    }
    if (q === lastQ) return;
    lastQ = q;
    
    try {
      const response = await fetch('/api/search-subjects?q=' + encodeURIComponent(q));
      const json = await response.json();
      renderSuggestions(json.subjects || []);
    } catch (error) {
      clearBox();
    }
  }
  
  input.addEventListener('input', e => {
    const q = (e.target.value || '').trim();
    clearTimeout(timer);
    timer = setTimeout(() => fetchSuggestions(q), 250);
  });
  
  // Handle search form submit
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) {
      window.location.href = '/search.html?q=' + encodeURIComponent(q);
    }
  });
  
  // Hide when clicking outside
  document.addEventListener('click', ev => {
    if (!box.contains(ev.target) && ev.target !== input) clearBox();
  });
  
  // Hide on escape
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') clearBox();
  });
}

// Utility function to escape HTML
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  initSearch();
});
