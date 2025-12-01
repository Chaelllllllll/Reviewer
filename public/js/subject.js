// Get subject ID from URL
const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');

if (!subjectId) {
  window.location.href = '/index.html';
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

    if (!subject) {
      window.location.href = '/index.html';
      return;
    }

    const header = document.getElementById('subjectHeader');
    header.innerHTML = `
      <h1 class="text-pink mb-2">
        <i class="bi bi-book-fill"></i> ${escapeHtml(subject.title)}
      </h1>
      <p class="text-muted mb-0">${escapeHtml(subject.description || '')}</p>
    `;

  } catch (error) {
    console.error('Error loading subject:', error);
    window.location.href = '/index.html';
  }
}

// Load reviewers for this subject
async function loadReviewers() {
  try {
    const { data: reviewers, error } = await supabase
      .from('reviewers')
      .select('*')
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    const container = document.getElementById('reviewersContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';

    if (!reviewers || reviewers.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-inbox" style="font-size: 4rem; color: var(--pink-primary);"></i>
          <h3 class="mt-3 text-muted">No reviewers available yet</h3>
          <p class="text-muted">Check back later for new content!</p>
        </div>
      `;
      return;
    }

    // Create reviewer cards
    container.innerHTML = reviewers.map((reviewer, index) => `
      <div class="col-12 mb-3">
        <div class="card">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-md-1 text-center">
                <div class="badge-pink">
                  ${index + 1}
                </div>
              </div>
              <div class="col-md-8">
                <h5 class="card-title mb-1">${escapeHtml(reviewer.title)}</h5>
                <small class="text-muted">
                  <i class="bi bi-calendar"></i> 
                  ${new Date(reviewer.created_at).toLocaleDateString()}
                </small>
              </div>
              <div class="col-md-3 text-end mt-3 mt-md-0">
                <a href="/reviewer.html?id=${reviewer.id}" class="btn btn-pink">
                  <i class="bi bi-eye"></i> View
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading reviewers:', error);
    const container = document.getElementById('reviewersContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i> 
          Failed to load reviewers. Please try again later.
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

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadSubject();
  loadReviewers();
});
