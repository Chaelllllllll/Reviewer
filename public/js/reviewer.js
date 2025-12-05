// Get reviewer ID from URL
const urlParams = new URLSearchParams(window.location.search);
const reviewerId = urlParams.get('id');

if (!reviewerId) {
  window.location.href = '/index.html';
}

// Require authentication and username
requireAuth().then(async (isAuth) => {
  if (!isAuth) return;
  await loadReviewer();
});

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
      <div class="small text-muted mt-2" id="viewerCount">
        <i class="bi bi-eye-fill text-success"></i> <span id="viewCountNumber">0</span> viewing now
      </div>
    `;

    // Track live viewers using Supabase Realtime Presence
    try {
      const presenceChannel = supabase.channel(`reviewer:${reviewerId}`, {
        config: {
          presence: {
            key: crypto.randomUUID() // Unique ID for this viewer
          }
        }
      });

      // Track presence state
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const viewerCount = Object.keys(state).length;
          const vcNumEl = document.getElementById('viewCountNumber');
          if (vcNumEl) {
            vcNumEl.textContent = viewerCount;
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Viewer joined:', key);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Viewer left:', key);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track this viewer as present
            await presenceChannel.track({
              online_at: new Date().toISOString(),
              reviewer_id: reviewerId
            });
          }
        });

      // Cleanup on page unload
      window.addEventListener('beforeunload', async () => {
        await presenceChannel.untrack();
        await presenceChannel.unsubscribe();
      });

      // Optional: Update last_viewed_at and total_views in background
      supabase
        .from('reviewers')
        .update({ 
          last_viewed_at: new Date().toISOString(),
          total_views: (reviewer.total_views || 0) + 1
        })
        .eq('id', reviewerId)
        .then(() => console.log('Updated view statistics'))
        .catch(err => console.warn('Failed to update statistics:', err));
    } catch (presenceErr) {
      console.warn('Presence tracking failed', presenceErr);
    }

    const content = document.getElementById('reviewerContent');
    content.innerHTML = reviewer.content || '<p class="text-muted">No content available.</p>';

    // Render action buttons (Download & Take Quiz)
    const actions = document.getElementById('reviewerActions');
    if (actions) {
      actions.style.display = 'block';
      actions.innerHTML = `
        <button class="btn btn-pink me-2 text-white" onclick="downloadPdf()">
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
