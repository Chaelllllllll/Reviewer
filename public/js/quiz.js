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
      .select('id, reviewer_id, question, type, points, order_index')
      .eq('reviewer_id', quizReviewerId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    if (!quizzes || quizzes.length === 0) {
      document.getElementById('quizContainer').innerHTML = '<p class="text-muted text-center py-4">No quiz available for this reviewer.</p>';
      return;
    }

    console.log('Loaded quiz data (no answers):', quizzes);
    
    // For multiple choice questions, we need to fetch options (but NOT correct_answer)
    const { data: quizzesWithOptions, error: optError } = await supabase
      .from('quizzes')
      .select('id, options')
      .eq('reviewer_id', quizReviewerId);
    
    if (optError) throw optError;
    
    // Create a map of quiz id to options
    const optionsMap = {};
    if (quizzesWithOptions) {
      quizzesWithOptions.forEach(q => {
        if (q.options) {
          const raw = q.options;
          let normalizedOptions = [];
          
          try {
            if (Array.isArray(raw)) {
              normalizedOptions = raw.map(item => {
                if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('{'))) {
                  try {
                    const parsed = JSON.parse(item);
                    return Array.isArray(parsed) ? parsed : item;
                  } catch (e) {
                    return item;
                  }
                }
                return item;
              }).flat();
            } else if (typeof raw === 'string') {
              try {
                const parsed = JSON.parse(raw);
                normalizedOptions = Array.isArray(parsed) ? parsed : [parsed];
              } catch (e) {
                normalizedOptions = raw.split(/\r?\n|\|/).map(s => s.trim()).filter(Boolean);
              }
            } else if (typeof raw === 'object') {
              normalizedOptions = Object.values(raw);
            } else {
              normalizedOptions = [String(raw)];
            }
          } catch (err) {
            console.error('Failed to parse options:', err);
            normalizedOptions = [];
          }
          
          optionsMap[q.id] = normalizedOptions;
        }
      });
    }
    
    // Merge quizzes with their options
    quizData = quizzes.map(q => ({
      ...q,
      options: q.type === 'multiple_choice' ? (optionsMap[q.id] || []) : undefined
    }));
    
    console.log('Normalized quiz data:', quizData);
    renderQuiz();
  } catch (err) {
    console.error('Failed to load quiz', err);
    document.getElementById('quizContainer').innerHTML = '<div class="alert alert-danger">Failed to load quiz.</div>';
  }
}

function renderQuiz() {
  const container = document.getElementById('quizContainer');
  try {
    container.innerHTML = quizData.map((q, idx) => {
      try {
        return `
          <div class="mb-4" data-qidx="${idx}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="mb-0">Question ${idx+1}</h5>
              <span class="badge bg-light text-pink">${q.points} ${q.points==1? 'pt':'pts'}</span>
            </div>
            <p>${escapeHtml(q.question)}</p>
            ${renderQuizQuestion(q, idx)}
          </div>
        `;
      } catch (err) {
        console.error('Error rendering question', idx, q, err);
        return `
          <div class="mb-4 alert alert-warning">
            <p>Error rendering question ${idx+1}</p>
            <small>Check console for details</small>
          </div>
        `;
      }
    }).join('');

    // ensure validation message placeholder exists
    let validationEl = document.getElementById('quizValidation');
    if (!validationEl) {
      validationEl = document.createElement('div');
      validationEl.id = 'quizValidation';
      validationEl.className = 'mb-3';
      const actionsContainer = document.getElementById('quizActions');
      actionsContainer.parentNode.insertBefore(validationEl, actionsContainer);
    }

    document.getElementById('quizActions').style.display = 'block';
    document.getElementById('submitBtn').onclick = submitQuiz;
  } catch (err) {
    console.error('Error rendering quiz:', err);
    container.innerHTML = '<div class="alert alert-danger">Failed to render quiz. Check console for details.</div>';
  }
}

function renderQuizQuestion(q, idx) {
  if (q.type === 'multiple_choice') {
    const options = q.options || [];
    
    console.log(`Rendering question ${idx}, type: ${q.type}, options:`, options, 'isArray:', Array.isArray(options));
    
    if (!Array.isArray(options)) {
      console.error('Options is not an array for question', idx, '- value:', options, 'type:', typeof options);
      return `<p class="text-danger">Invalid question format (options is ${typeof options})</p>`;
    }
    
    if (options.length === 0) {
      console.warn('No valid options for question:', q);
      return `<p class="text-muted">No options available for this question.</p>`;
    }

    return `
      <div>
        ${options.map((opt, optIdx) => `
          <div class="quiz-option" data-q="${idx}" data-opt="${optIdx}" onclick="selectOption(${idx}, ${optIdx})">
            ${escapeHtml(String(opt))}
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

async function submitQuiz() {
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Grading...';
  
  // Clear previous validation highlights
  document.querySelectorAll('[data-qidx]').forEach(el => el.classList.remove('question-missing'));
  const validationEl = document.getElementById('quizValidation');
  if (validationEl) validationEl.innerHTML = '';

  // Validate required answers
  const missing = [];
  quizData.forEach((q, idx) => {
    if (q.type === 'multiple_choice') {
      if (userAnswers[idx] === undefined || userAnswers[idx] === null || userAnswers[idx] === '') missing.push(idx);
    } else if (q.type === 'short_answer' || q.type === 'long_answer') {
      const val = userAnswers[idx];
      if (!val || String(val).trim() === '') missing.push(idx);
    }
  });

  if (missing.length > 0) {
    // mark missing questions
    missing.forEach(i => {
      const el = document.querySelector(`[data-qidx="${i}"]`);
      if (el) el.classList.add('question-missing');
    });
    // show validation message and scroll to first missing
    const first = document.querySelector(`[data-qidx="${missing[0]}"]`);
    if (validationEl) validationEl.innerHTML = `<div class="alert alert-danger">Please answer all required questions. ${missing.length} unanswered.</div>`;
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Submit Quiz';
    return;
  }

  try {
    // Try server-side grading first
    const { data, error } = await supabase.functions.invoke('grade-quiz', {
      body: { reviewerId: quizReviewerId, answers: userAnswers }
    });
    
    // If Edge Function not deployed, fall back to client-side grading
    if (error && error.message.includes('Failed to send a request')) {
      console.warn('Edge Function not deployed, using client-side grading (answers exposed)');
      await clientSideGrading();
      return;
    }
    
    if (error) throw error;
    
    const { totalPoints, earnedPoints, percentage, results: gradingResults } = data;
    
    const resultsDiv = document.getElementById('quizResults');
    const actions = document.getElementById('quizActions');
    actions.style.display = 'none';
    resultsDiv.style.display = 'block';

    resultsDiv.innerHTML = `
      <div class="card">
        <div class="card-body text-center">
          <h3 class="text-pink"><i class="bi bi-trophy-fill"></i> Quiz Complete</h3>
          <h1 class="display-3 text-pink">${percentage}%</h1>
          <p class="lead">You scored ${earnedPoints} of ${totalPoints} points</p>
          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-pink" onclick="retakeQuiz()">Retake Quiz</button>
            <a class="btn btn-outline-pink" href="/reviewer.html?id=${quizReviewerId}">Back to Content</a>
          </div>
        </div>
      </div>
    `;

    // Highlight correct/incorrect based on server results (without showing correct answers)
    gradingResults.forEach(result => {
      const qIdx = result.questionIndex;
      const isCorrect = result.correct;
      
      if (quizData[qIdx].type === 'multiple_choice') {
        document.querySelectorAll(`.quiz-option[data-q="${qIdx}"]`).forEach(el => {
          const opt = parseInt(el.getAttribute('data-opt'));
          const userSelected = userAnswers[qIdx];
          
          // Only highlight the user's selection as correct or incorrect
          if (userSelected !== undefined && parseInt(userSelected) === opt) {
            el.classList.add(isCorrect ? 'correct' : 'incorrect');
          }
        });
      }
    });
    
  } catch (error) {
    console.error('Error grading quiz:', error);
    alert('Failed to grade quiz. Please try again.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Submit Quiz';
  }
}

// Fallback client-side grading (when Edge Function is not deployed)
async function clientSideGrading() {
  // Fetch quiz with correct answers for client-side grading
  const { data: quizzesWithAnswers, error } = await supabase
    .from('quizzes')
    .select('correct_answer, points, type')
    .eq('reviewer_id', quizReviewerId)
    .order('order_index', { ascending: true });
  
  if (error) {
    console.error('Failed to fetch quiz answers:', error);
    alert('Failed to grade quiz. Please try again.');
    return;
  }
  
  let totalPoints = 0, earnedPoints = 0;
  
  quizzesWithAnswers.forEach((q, idx) => {
    totalPoints += q.points || 1;
    
    if (q.type === 'multiple_choice') {
      const correct = typeof q.correct_answer === 'string' && /^\d+$/.test(q.correct_answer)
        ? parseInt(q.correct_answer)
        : q.correct_answer;
      
      if (userAnswers[idx] !== undefined && String(userAnswers[idx]) === String(correct)) {
        earnedPoints += q.points || 1;
      }
    } else {
      if (userAnswers[idx] && String(userAnswers[idx]).trim()) {
        earnedPoints += q.points || 1;
      }
    }
  });
  
  const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
  
  const resultsDiv = document.getElementById('quizResults');
  const actions = document.getElementById('quizActions');
  actions.style.display = 'none';
  resultsDiv.style.display = 'block';

  resultsDiv.innerHTML = `
    <div class="card">
      <div class="card-body text-center">
        <h3 class="text-pink"><i class="bi bi-trophy-fill"></i> Quiz Complete</h3>
        <h1 class="display-3 text-pink">${percentage}%</h1>
        <p class="lead">You scored ${earnedPoints} of ${totalPoints} points</p>
        <div class="d-flex justify-content-center gap-2">
          <button class="btn btn-pink" onclick="retakeQuiz()">Retake Quiz</button>
          <a class="btn btn-outline-pink" href="/reviewer.html?id=${quizReviewerId}">Back to Content</a>
        </div>
      </div>
    </div>
  `;

  // Highlight based on client-side comparison
  quizzesWithAnswers.forEach((q, idx) => {
    if (q.type === 'multiple_choice') {
      const correct = typeof q.correct_answer === 'string' && /^\d+$/.test(q.correct_answer)
        ? parseInt(q.correct_answer)
        : parseInt(q.correct_answer) || 0;
      
      const isCorrect = userAnswers[idx] !== undefined && String(userAnswers[idx]) === String(correct);
      
      document.querySelectorAll(`.quiz-option[data-q="${idx}"]`).forEach(el => {
        const opt = parseInt(el.getAttribute('data-opt'));
        const userSelected = userAnswers[idx];
        
        if (userSelected !== undefined && parseInt(userSelected) === opt) {
          el.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
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
