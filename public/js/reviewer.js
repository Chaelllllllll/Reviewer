// Get reviewer ID from URL
const urlParams = new URLSearchParams(window.location.search);
const reviewerId = urlParams.get('id');

let quizData = [];
let userAnswers = {};

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

// Load quiz questions
async function loadQuiz() {
  try {
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('reviewer_id', reviewerId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    if (!quizzes || quizzes.length === 0) {
      return; // No quiz available
    }

    quizData = quizzes;
    const quizSection = document.getElementById('quizSection');
    const container = document.getElementById('quizContainer');

    quizSection.style.display = 'block';

    container.innerHTML = quizzes.map((quiz, index) => {
      return `
        <div class="mb-4 p-4" style="background-color: var(--pink-lighter); border-radius: 15px;">
          <h5 class="fw-bold mb-3">
            Question ${index + 1} 
            <span class="badge badge-pink">${quiz.points} ${quiz.points === 1 ? 'point' : 'points'}</span>
          </h5>
          <p class="mb-3">${escapeHtml(quiz.question)}</p>
          
          ${renderQuizQuestion(quiz, index)}
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading quiz:', error);
  }
}

// Render quiz question based on type
function renderQuizQuestion(quiz, index) {
  switch (quiz.type) {
    case 'multiple_choice':
      const options = JSON.parse(quiz.options || '[]');
      return `
        <div class="quiz-options">
          ${options.map((option, optIndex) => `
            <div class="quiz-option" onclick="selectOption(${index}, ${optIndex})">
              <input type="radio" name="quiz_${index}" id="quiz_${index}_${optIndex}" value="${optIndex}" style="display: none;">
              <label for="quiz_${index}_${optIndex}" class="w-100 mb-0" style="cursor: pointer;">
                ${escapeHtml(option)}
              </label>
            </div>
          `).join('')}
        </div>
      `;
    
    case 'short_answer':
      return `
        <input type="text" class="form-control" id="quiz_${index}" placeholder="Type your answer here..." 
          onchange="userAnswers[${index}] = this.value">
      `;
    
    case 'long_answer':
      return `
        <textarea class="form-control" id="quiz_${index}" rows="5" placeholder="Type your answer here..." 
          onchange="userAnswers[${index}] = this.value"></textarea>
      `;
    
    default:
      return '<p class="text-muted">Invalid question type</p>';
  }
}

// Select multiple choice option
function selectOption(questionIndex, optionIndex) {
  userAnswers[questionIndex] = optionIndex;
  
  // Update UI
  const options = document.querySelectorAll(`input[name="quiz_${questionIndex}"]`);
  options.forEach((opt, idx) => {
    const parent = opt.closest('.quiz-option');
    if (idx === optionIndex) {
      opt.checked = true;
      parent.classList.add('selected');
    } else {
      opt.checked = false;
      parent.classList.remove('selected');
    }
  });
}

// Submit quiz
function submitQuiz() {
  let totalPoints = 0;
  let earnedPoints = 0;

  quizData.forEach((quiz, index) => {
    totalPoints += quiz.points;
    
    if (quiz.type === 'multiple_choice') {
      const correctAnswer = parseInt(quiz.correct_answer);
      const userAnswer = userAnswers[index];
      
      if (userAnswer === correctAnswer) {
        earnedPoints += quiz.points;
        
        // Mark as correct
        const option = document.querySelector(`input[name="quiz_${index}"][value="${userAnswer}"]`);
        if (option) {
          option.closest('.quiz-option').classList.remove('selected');
          option.closest('.quiz-option').classList.add('correct');
        }
      } else {
        // Mark user's answer as incorrect
        if (userAnswer !== undefined) {
          const option = document.querySelector(`input[name="quiz_${index}"][value="${userAnswer}"]`);
          if (option) {
            option.closest('.quiz-option').classList.remove('selected');
            option.closest('.quiz-option').classList.add('incorrect');
          }
        }
        
        // Show correct answer
        const correctOption = document.querySelector(`input[name="quiz_${index}"][value="${correctAnswer}"]`);
        if (correctOption) {
          correctOption.closest('.quiz-option').classList.add('correct');
        }
      }
    } else {
      // For short/long answer, just show if they answered
      if (userAnswers[index] && userAnswers[index].trim()) {
        earnedPoints += quiz.points; // Auto-award points for subjective questions
      }
    }
  });

  const percentage = Math.round((earnedPoints / totalPoints) * 100);
  
  const resultsDiv = document.getElementById('quizResults');
  const actionsDiv = document.getElementById('quizActions');
  
  actionsDiv.style.display = 'none';
  resultsDiv.style.display = 'block';
  
  resultsDiv.innerHTML = `
    <div class="card">
      <div class="card-body text-center py-5">
        <h2 class="text-pink mb-3">
          <i class="bi bi-trophy-fill"></i> Quiz Complete!
        </h2>
        <h1 class="display-1 text-pink fw-bold mb-3">${percentage}%</h1>
        <p class="lead mb-3">You scored ${earnedPoints} out of ${totalPoints} points</p>
        <button class="btn btn-pink btn-lg" onclick="retakeQuiz()">
          <i class="bi bi-arrow-clockwise"></i> Retake Quiz
        </button>
      </div>
    </div>
  `;
  
  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Retake quiz
function retakeQuiz() {
  userAnswers = {};
  loadQuiz();
  
  const resultsDiv = document.getElementById('quizResults');
  const actionsDiv = document.getElementById('quizActions');
  
  resultsDiv.style.display = 'none';
  actionsDiv.style.display = 'block';
  
  // Scroll to quiz
  document.getElementById('quizSection').scrollIntoView({ behavior: 'smooth' });
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
  loadQuiz();
});
