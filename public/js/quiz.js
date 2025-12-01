// Quiz page script
const quizUrlParams = new URLSearchParams(window.location.search);
const quizReviewerId = quizUrlParams.get('id');

let quizData = [];
let userAnswers = {};

if (!quizReviewerId) {
  window.location.href = '/index.html';
}

async function loadReviewerTitle() {
  try {
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select('title, subjects(title)')
      .eq('id', quizReviewerId)
      .single();

    if (error) throw error;

    const header = document.getElementById('quizHeader');
    header.innerHTML = `
      <div>
        <h2 class="mb-1 text-pink">${escapeHtml(reviewer.title)}</h2>
        <small class="text-muted"><i class="bi bi-folder"></i> ${escapeHtml(reviewer.subjects?.title || 'Unknown Subject')}</small>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load reviewer title', err);
    document.getElementById('quizHeader').innerHTML = '<p class="text-danger">Failed to load quiz</p>';
  }
}

async function loadQuiz() {
  try {
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('reviewer_id', quizReviewerId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    if (!quizzes || quizzes.length === 0) {
      document.getElementById('quizContainer').innerHTML = '<p class="text-muted text-center py-4">No quiz available for this reviewer.</p>';
      return;
    }

    quizData = quizzes;
    renderQuiz();
  } catch (err) {
    console.error('Failed to load quiz', err);
    document.getElementById('quizContainer').innerHTML = '<div class="alert alert-danger">Failed to load quiz.</div>';
  }
}

function renderQuiz() {
  const container = document.getElementById('quizContainer');
  container.innerHTML = quizData.map((q, idx) => `
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h5 class="mb-0">Question ${idx+1}</h5>
        <span class="badge bg-light text-pink">${q.points} ${q.points==1? 'pt':'pts'}</span>
      </div>
      <p>${escapeHtml(q.question)}</p>
      ${renderQuizQuestion(q, idx)}
    </div>
  `).join('');

  document.getElementById('quizActions').style.display = 'block';
  document.getElementById('submitBtn').onclick = submitQuiz;
}

function renderQuizQuestion(q, idx) {
  if (q.type === 'multiple_choice') {
    const options = JSON.parse(q.options || '[]');
    return `
      <div>
        ${options.map((opt, optIdx) => `
          <div class="quiz-option" data-q="${idx}" data-opt="${optIdx}" onclick="selectOption(${idx}, ${optIdx})">
            ${escapeHtml(opt)}
          </div>
        `).join('')}
      </div>
    `;
  }
  if (q.type === 'short_answer') {
    return `<input class="form-control" type="text" id="qa_${idx}" onchange="recordAnswer(${idx}, this.value)">`;
  }
  if (q.type === 'long_answer') {
    return `<textarea class="form-control" id="qa_${idx}" rows="4" onchange="recordAnswer(${idx}, this.value)"></textarea>`;
  }
  return '<p class="text-muted">Unsupported question type</p>';
}

function selectOption(qIdx, optIdx) {
  userAnswers[qIdx] = optIdx;
  // Update UI
  document.querySelectorAll(`.quiz-option[data-q="${qIdx}"]`).forEach(el => el.classList.remove('selected'));
  const el = document.querySelector(`.quiz-option[data-q="${qIdx}"][data-opt="${optIdx}"]`);
  if (el) el.classList.add('selected');
}

function recordAnswer(qIdx, value) {
  userAnswers[qIdx] = value;
}

function submitQuiz() {
  let total = 0, earned = 0;
  quizData.forEach((q, idx) => {
    total += q.points;
    if (q.type === 'multiple_choice') {
      const correct = parseInt(q.correct_answer);
      if (userAnswers[idx] !== undefined && parseInt(userAnswers[idx]) === correct) {
        earned += q.points;
      }
    } else {
      if (userAnswers[idx] && String(userAnswers[idx]).trim()) earned += q.points; // subjective auto-award
    }
  });

  const pct = total === 0 ? 0 : Math.round((earned/total)*100);
  const results = document.getElementById('quizResults');
  const actions = document.getElementById('quizActions');
  actions.style.display = 'none';
  results.style.display = 'block';

  results.innerHTML = `
    <div class="card">
      <div class="card-body text-center">
        <h3 class="text-pink"><i class="bi bi-trophy-fill"></i> Quiz Complete</h3>
        <h1 class="display-3 text-pink">${pct}%</h1>
        <p class="lead">You scored ${earned} of ${total} points</p>
        <div class="d-flex justify-content-center gap-2">
          <button class="btn btn-pink" onclick="retakeQuiz()">Retake Quiz</button>
          <a class="btn btn-outline-pink" href="/reviewer.html?id=${quizReviewerId}">Back to Content</a>
        </div>
      </div>
    </div>
  `;

  // Highlight correct/incorrect for MCQ
  quizData.forEach((q, idx) => {
    if (q.type === 'multiple_choice') {
      const correct = parseInt(q.correct_answer);
      document.querySelectorAll(`.quiz-option[data-q="${idx}"]`).forEach(el => {
        const opt = parseInt(el.getAttribute('data-opt'));
        if (opt === correct) el.classList.add('correct');
        if (userAnswers[idx] !== undefined && parseInt(userAnswers[idx]) === opt && opt !== correct) el.classList.add('incorrect');
      });
    }
  });
}

function retakeQuiz() {
  userAnswers = {};
  document.getElementById('quizResults').style.display = 'none';
  document.getElementById('quizActions').style.display = 'block';
  // clear selections
  document.querySelectorAll('.quiz-option').forEach(el => el.classList.remove('selected', 'correct', 'incorrect'));
  // clear inputs
  document.querySelectorAll('input[id^="qa_"]').forEach(i => i.value = '');
  document.querySelectorAll('textarea[id^="qa_"]').forEach(t => t.value = '');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadReviewerTitle();
  await loadQuiz();
});
