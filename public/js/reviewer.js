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

async function loadReviewer() {
  const params = new URLSearchParams(window.location.search);
  const reviewerId = params.get('id');
  
  if (!reviewerId) {
    window.location.href = '/';
    return;
  }
  
  try {
    const response = await fetch('/api/reviewer/' + reviewerId);
    const data = await response.json();
    
    if (!data.reviewer) {
      window.location.href = '/';
      return;
    }
    
    const reviewer = data.reviewer;
    const subject = reviewer.subjects || {};
    
    // Update breadcrumb
    document.getElementById('breadcrumb').innerHTML = `
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item"><a href="/subject.html?id=${subject.id}">${escapeHtml(subject.name || 'Subject')}</a></li>
          <li class="breadcrumb-item active" aria-current="page">${escapeHtml(reviewer.title)}</li>
        </ol>
      </nav>
    `;
    
    // Check if quiz exists
    let quiz = null;
    if (reviewer.quiz) {
      try {
        quiz = typeof reviewer.quiz === 'string' ? JSON.parse(reviewer.quiz) : reviewer.quiz;
      } catch (e) {
        console.warn('Could not parse quiz:', e);
      }
    }
    
    const hasQuiz = quiz && Array.isArray(quiz.questions) && quiz.questions.length > 0;
    
    // Update content
    document.getElementById('reviewerContent').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="mb-0">
            <i class="bi bi-file-earmark-text me-2"></i>
            ${escapeHtml(reviewer.title)}
          </h2>
        </div>
        <div class="card-body">
          <div class="reviewer-content">
            ${escapeHtml(reviewer.content || 'No content available.').replace(/\n/g, '<br>')}
          </div>
          
          ${hasQuiz ? `
            <div class="mt-4">
              <a href="/quiz.html?id=${reviewer.id}" class="btn btn-success btn-lg">
                <i class="bi bi-question-circle-fill me-2"></i>Take Quiz
              </a>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="mt-3">
        <a href="/subject.html?id=${subject.id}" class="btn btn-secondary">
          <i class="bi bi-arrow-left me-2"></i>Back to ${escapeHtml(subject.name || 'Subject')}
        </a>
      </div>
    `;
  } catch (error) {
    console.error('Error loading reviewer:', error);
    document.getElementById('reviewerContent').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Error loading reviewer. Please try again later.
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', loadReviewer);
