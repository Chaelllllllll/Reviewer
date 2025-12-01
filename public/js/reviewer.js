// Get reviewer ID from URL
const urlParams = new URLSearchParams(window.location.search);
const reviewerId = urlParams.get('id');

if (!reviewerId) {
  window.location.href = '/index.html';
}

// Load reviewer details
async function loadReviewer() {
  try {
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select('*, subjects(title)')
      .eq('id', reviewerId)
      .single();

    if (error) throw error;

    if (!reviewer) {
      window.location.href = '/index.html';
      return;
    }

    const header = document.getElementById('reviewerHeader');
    header.innerHTML = `
      <h1 class="text-pink mb-2">
        ${escapeHtml(reviewer.title)}
      </h1>
      <p class="text-muted mb-0">
        <i class="bi bi-folder"></i> ${escapeHtml(reviewer.subjects?.title || 'Unknown Subject')}
      </p>
    `;

    const content = document.getElementById('reviewerContent');
    content.innerHTML = reviewer.content || '<p class="text-muted">No content available.</p>';

    // Render action buttons (Download & Take Quiz)
    const actions = document.getElementById('reviewerActions');
    if (actions) {
      actions.style.display = 'block';
      actions.innerHTML = `
        <button class="btn btn-pink me-2" onclick="downloadPdf()">
          <i class="bi bi-file-earmark-arrow-down"></i> Download as PDF
        </button>
        <button class="btn btn-outline-pink" onclick="goToQuiz()">
          <i class="bi bi-question-circle"></i> Take Quiz
        </button>
      `;
    }
  } catch (error) {
    console.error('Error loading reviewer:', error);
    const content = document.getElementById('reviewerContent');
    content.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle-fill"></i> 
        Failed to load reviewer content.
      </div>
    `;
  }
}
// Download reviewer content as PDF (opens print dialog)
function downloadPdf() {
  const content = document.getElementById('reviewerContent').innerHTML;
  const titleEl = document.querySelector('#reviewerHeader h1');
  const title = titleEl ? titleEl.textContent : 'Reviewer';

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif; padding:20px; color:#333}</style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${content}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  // do not auto-close to allow user to save if needed
}

// Open quiz page for this reviewer
function goToQuiz() {
  window.location.href = `/quiz.html?id=${reviewerId}`;
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadReviewer();
});
