// In-memory cache of subjects for filtering
let allSubjects = [];

// Load and display all subjects
async function loadSubjects() {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('subjectsContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';

    // cache subjects for search
    allSubjects = subjects || [];

    // initialize search handlers
    initSubjectSearch();

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-inbox" style="font-size: 4rem; color: var(--pink-primary);"></i>
          <h3 class="mt-3 text-muted">No subjects available yet</h3>
          <p class="text-muted">Check back later for new content!</p>
        </div>
      `;
      return;
    }

    // Create subject cards
    container.innerHTML = subjects.map(subject => `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100">
          <div class="card-header" style="background-color: ${subject.color || '#FFD4E5'};">
            <h5 class="mb-0 text-white">
              <i class="bi bi-book"></i> ${escapeHtml(subject.title)}
            </h5>
          </div>
          <div class="card-body d-flex flex-column">
            <p class="card-text flex-grow-1">${escapeHtml(subject.description || 'No description available.')}</p>
            <a href="/subject.html?id=${subject.id}" class="btn btn-pink w-100 mt-3">
              <i class="bi bi-eye"></i> View Reviewers
            </a>
          </div>
        </div>
      </div>
    `).join('');

    // If there are no subjects, still show the no-results UI handled above

  } catch (error) {
    console.error('Error loading subjects:', error);
    const container = document.getElementById('subjectsContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i> 
          Failed to load subjects. Please try again later.
        </div>
      </div>
    `;
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load subjects when page loads
document.addEventListener('DOMContentLoaded', loadSubjects);

// Initialize search input behavior
function initSubjectSearch() {
  const searchEl = document.getElementById('subjectSearch');
  const clearBtn = document.getElementById('clearSearch');
  if (!searchEl) return;

  // debounce helper
  let t = null;
  searchEl.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      filterSubjects(q);
    }, 180);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchEl.value = '';
      clearBtn.style.display = 'none';
      filterSubjects('');
      searchEl.focus();
    });
  }
}

function filterSubjects(q) {
  const container = document.getElementById('subjectsContainer');
  if (!container) return;
  const items = allSubjects.filter(s => {
    if (!q) return true;
    const hay = `${s.title} ${s.description || ''}`.toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search" style="font-size: 4rem; color: var(--pink-primary);"></i>
        <h3 class="mt-3 text-muted">No matching subjects</h3>
        <p class="text-muted">Try a different search term.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(subject => `
    <div class="col-md-6 col-lg-4 mb-4">
      <div class="card h-100">
        <div class="card-header" style="background-color: ${subject.color || '#FFD4E5'};">
          <h5 class="mb-0 text-white">
            <i class="bi bi-book"></i> ${escapeHtml(subject.title)}
          </h5>
        </div>
        <div class="card-body d-flex flex-column">
          <p class="card-text flex-grow-1">${escapeHtml(subject.description || 'No description available.')}</p>
          <a href="/subject.html?id=${subject.id}" class="btn btn-pink w-100 mt-3">
            <i class="bi bi-eye"></i> View Reviewers
          </a>
        </div>
      </div>
    </div>
  `).join('');
}
