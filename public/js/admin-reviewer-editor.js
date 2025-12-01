const urlParams = new URLSearchParams(window.location.search);
const reviewerId = urlParams.get('id');
const subjectId = urlParams.get('subject_id');

let quill;
let questionModal;
let quizQuestions = [];
let currentQuestionIndex = null;
let optionCounter = 2;
let importModal;

// Helpers to parse options and normalize correct answers
function parseOptions(raw) {
  try {
    if (Array.isArray(raw)) {
      // If it's already an array, check if elements need parsing
      return raw.map(item => {
        if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('{'))) {
          try {
            const parsed = JSON.parse(item);
            return Array.isArray(parsed) ? parsed : item;
          } catch (e) {
            return item;
          }
        }
        return item;
      }).flat(); // Flatten in case any elements were arrays
    }
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return raw.split(/\r?\n|\|/).map(s => s.trim()).filter(Boolean);
      }
    }
    if (typeof raw === 'object') {
      return Object.values(raw).map(v => (v && v.text) ? v.text : v);
    }
    return [String(raw)];
  } catch (err) {
    console.warn('parseOptions failed', err, raw);
    return [];
  }
}

function normalizeCorrectAnswer(correct, optionsArr) {
  if (typeof correct === 'number') return correct;
  if (typeof correct === 'string' && /^\d+$/.test(correct)) return parseInt(correct);
  if (typeof correct === 'string') {
    const idx = optionsArr.findIndex(o => String(o) === correct);
    if (idx !== -1) return idx;
  }
  return correct;
}

// Check authentication and initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  questionModal = new bootstrap.Modal(document.getElementById('questionModal'));
  importModal = new bootstrap.Modal(document.getElementById('importModal'));
  const importFileEl = document.getElementById('importFile');
  if (importFileEl) importFileEl.addEventListener('change', (e) => {
    const preview = document.getElementById('importPreview');
    if (preview) preview.textContent = `Selected file: ${importFileEl.files && importFileEl.files.length ? importFileEl.files[0].name : ''}`;
  });
  
  // Initialize Quill editor
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
      ]
    },
    placeholder: 'Write your reviewer content here... You can add text, code blocks, tables, images, and more!'
  });
  
  if (reviewerId) {
    document.getElementById('pageTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Reviewer';
    loadReviewer();
  } else if (!subjectId) {
    alert('Subject ID is required');
    window.location.href = '/admin/dashboard.html';
  }
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Go back
function goBack() {
  if (subjectId) {
    window.location.href = `/admin/subject-reviewers.html?id=${subjectId}`;
  } else {
    window.location.href = '/admin/dashboard.html';
  }
}

// Load existing reviewer
async function loadReviewer() {
  try {
    const { data: reviewer, error } = await supabase
      .from('reviewers')
      .select('*')
      .eq('id', reviewerId)
      .single();

    if (error) throw error;

    document.getElementById('reviewerTitle').value = reviewer.title;
    quill.root.innerHTML = reviewer.content;

    // Load quizzes
    const { data: quizzes, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('reviewer_id', reviewerId)
      .order('order_index', { ascending: true });

    if (!quizError && quizzes) {
      // Normalize options and correct_answer for each quiz item
      quizQuestions = quizzes.map(q => {
        const opts = parseOptions(q.options);
        return {
          ...q,
          options: opts,
          correct_answer: normalizeCorrectAnswer(q.correct_answer, opts)
        };
      });
      renderQuizQuestions();
    }

  } catch (error) {
    console.error('Error loading reviewer:', error);
    alert('Failed to load reviewer. Please try again.');
  }
}

// Save reviewer
async function saveReviewer() {
  const title = document.getElementById('reviewerTitle').value.trim();
  const content = quill.root.innerHTML;

  if (!title) {
    alert('Please enter a title');
    return;
  }

  if (quill.getText().trim().length === 0) {
    alert('Please add some content');
    return;
  }

  try {
    let currentReviewerId = reviewerId;

    if (reviewerId) {
      // Update existing reviewer
      const { error } = await supabase
        .from('reviewers')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', reviewerId);

      if (error) throw error;
    } else {
      // Create new reviewer
      const { data, error } = await supabase
        .from('reviewers')
        .insert([{ 
          subject_id: subjectId, 
          title, 
          content,
          order_index: 0
        }])
        .select();

      if (error) throw error;
      currentReviewerId = data[0].id;
    }

    // Save quiz questions
    await saveQuizQuestions(currentReviewerId);

    alert('Reviewer saved successfully!');
    
    if (!reviewerId) {
      window.location.href = `/admin/subject-reviewers.html?id=${subjectId}`;
    }

  } catch (error) {
    console.error('Error saving reviewer:', error);
    alert('Failed to save reviewer. Please try again.');
  }
}

// Save quiz questions
async function saveQuizQuestions(revId) {
  try {
    // Delete existing quizzes if updating
    if (reviewerId) {
      await supabase
        .from('quizzes')
        .delete()
        .eq('reviewer_id', reviewerId);
    }

    // Insert new quizzes
    if (quizQuestions.length > 0) {
      const quizzesToInsert = quizQuestions.map((q, index) => ({
        reviewer_id: revId,
        question: q.question,
        type: q.type,
        options: q.options ? JSON.stringify(q.options) : null,
        correct_answer: q.correct_answer,
        points: q.points,
        order_index: index
      }));

      const { error } = await supabase
        .from('quizzes')
        .insert(quizzesToInsert);

      if (error) throw error;
    }

  } catch (error) {
    console.error('Error saving quizzes:', error);
    throw error;
  }
}

// Show add question modal
function showAddQuestionModal() {
  currentQuestionIndex = null;
  document.getElementById('questionModalTitle').textContent = 'Add Question';
  document.getElementById('questionForm').reset();
  document.getElementById('questionIndex').value = '';
  document.getElementById('questionPoints').value = '1';
  
  // Reset options
  resetOptions();
  handleQuestionTypeChange();
  
  questionModal.show();
}

// Edit question
function editQuestion(index) {
  currentQuestionIndex = index;
  const question = quizQuestions[index];
  
  document.getElementById('questionModalTitle').textContent = 'Edit Question';
  document.getElementById('questionIndex').value = index;
  document.getElementById('questionText').value = question.question;
  document.getElementById('questionType').value = question.type;
  document.getElementById('questionPoints').value = question.points;
  
  if (question.type === 'multiple_choice') {
    resetOptions();
    const optionsContainer = document.getElementById('optionsContainer');
    const opts = Array.isArray(question.options) ? question.options : [];
    optionsContainer.innerHTML = opts.map((opt, idx) => `
      <div class="option-input">
        <input type="radio" name="correctOption" value="${idx}" ${question.correct_answer == idx ? 'checked' : ''}>
        <input type="text" class="form-control" placeholder="Option ${idx + 1}" data-option-index="${idx}" value="${escapeHtml(opt)}">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOption(${idx})" ${idx < 2 ? 'style="display: none;"' : ''}>
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `).join('');
    optionCounter = opts.length;
  } else {
    document.getElementById('sampleAnswer').value = question.correct_answer || '';
  }
  
  handleQuestionTypeChange();
  questionModal.show();
}

// Handle question type change
function handleQuestionTypeChange() {
  const type = document.getElementById('questionType').value;
  const mcSection = document.getElementById('multipleChoiceSection');
  const answerSection = document.getElementById('answerSection');
  
  if (type === 'multiple_choice') {
    mcSection.style.display = 'block';
    answerSection.style.display = 'none';
  } else {
    mcSection.style.display = 'none';
    answerSection.style.display = 'block';
  }
}

// Reset options
function resetOptions() {
  optionCounter = 2;
  const container = document.getElementById('optionsContainer');
  container.innerHTML = `
    <div class="option-input">
      <input type="radio" name="correctOption" value="0" checked>
      <input type="text" class="form-control" placeholder="Option 1" data-option-index="0">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOption(0)" style="display: none;">
        <i class="bi bi-trash"></i>
      </button>
    </div>
    <div class="option-input">
      <input type="radio" name="correctOption" value="1">
      <input type="text" class="form-control" placeholder="Option 2" data-option-index="1">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOption(1)" style="display: none;">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
}

// Add option
function addOption() {
  const container = document.getElementById('optionsContainer');
  const div = document.createElement('div');
  div.className = 'option-input';
  div.innerHTML = `
    <input type="radio" name="correctOption" value="${optionCounter}">
    <input type="text" class="form-control" placeholder="Option ${optionCounter + 1}" data-option-index="${optionCounter}">
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeOption(${optionCounter})">
      <i class="bi bi-trash"></i>
    </button>
  `;
  container.appendChild(div);
  optionCounter++;
}

// Remove option
function removeOption(index) {
  const options = document.querySelectorAll('.option-input');
  if (options.length <= 2) {
    alert('You must have at least 2 options');
    return;
  }
  options[index].remove();
}

// Save question
function saveQuestion() {
  const question = document.getElementById('questionText').value.trim();
  const type = document.getElementById('questionType').value;
  const points = parseInt(document.getElementById('questionPoints').value) || 1;
  
  if (!question) {
    alert('Please enter a question');
    return;
  }
  
  let questionData = { question, type, points };
  
  if (type === 'multiple_choice') {
    const optionInputs = document.querySelectorAll('#optionsContainer input[type="text"]');
    const options = Array.from(optionInputs).map(input => input.value.trim());
    
    if (options.some(opt => !opt)) {
      alert('Please fill in all options');
      return;
    }
    
    const correctOption = document.querySelector('input[name="correctOption"]:checked');
    if (!correctOption) {
      alert('Please select the correct answer');
      return;
    }
    
    questionData.options = options;
    questionData.correct_answer = correctOption.value;
  } else {
    questionData.correct_answer = document.getElementById('sampleAnswer').value.trim();
  }
  
  if (currentQuestionIndex !== null) {
    quizQuestions[currentQuestionIndex] = questionData;
  } else {
    quizQuestions.push(questionData);
  }
  
  renderQuizQuestions();
  questionModal.hide();
}

// Delete question
function deleteQuestion(index) {
  if (confirm('Are you sure you want to delete this question?')) {
    quizQuestions.splice(index, 1);
    renderQuizQuestions();
  }
}

// Render quiz questions
function renderQuizQuestions() {
  const container = document.getElementById('quizContainer');
  
  if (quizQuestions.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-4">No quiz questions yet. Click "Add Question" to create one.</p>';
    return;
  }
  
  container.innerHTML = quizQuestions.map((q, index) => `
    <div class="quiz-question-card">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div class="flex-grow-1">
          <h5 class="fw-bold">
            Question ${index + 1}
            <span class="badge badge-pink ms-2">${q.points} ${q.points === 1 ? 'point' : 'points'}</span>
            <span class="badge bg-secondary ms-2">${formatQuestionType(q.type)}</span>
          </h5>
          <p class="mb-2">${escapeHtml(q.question)}</p>
          
          ${q.type === 'multiple_choice' ? `
            <div class="ms-3">
              ${(Array.isArray(q.options) ? q.options : []).map((opt, optIdx) => `
                <div class="${optIdx == q.correct_answer ? 'text-success fw-bold' : ''}">
                  ${optIdx == q.correct_answer ? '✓' : '○'} ${escapeHtml(opt)}
                </div>
              `).join('')}
            </div>
          ` : q.correct_answer ? `
            <div class="ms-3">
              <small class="text-muted">Sample answer: ${escapeHtml(q.correct_answer)}</small>
            </div>
          ` : ''}
        </div>
        
        <div class="btn-group ms-3">
          <button class="btn btn-sm btn-outline-pink" onclick="editQuestion(${index})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteQuestion(${index})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Import helpers
function showImportModal() {
  // clear inputs
  const fileEl = document.getElementById('importFile');
  const textEl = document.getElementById('importText');
  const preview = document.getElementById('importPreview');
  if (fileEl) fileEl.value = '';
  if (textEl) textEl.value = '';
  if (preview) preview.textContent = '';
  importModal.show();
}

function parseCSV(text) {
  // very small CSV parser: assumes first line is header, comma separated
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    // naive split - does not handle quoted commas
    const cols = line.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? '');
    return obj;
  });
  return rows;
}

function parseImportContent(content, filename) {
  // try JSON first
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    // if object with data property
    if (parsed && parsed.data && Array.isArray(parsed.data)) return parsed.data;
  } catch (e) {
    // not JSON
  }

  // fallback to CSV
  return parseCSV(content);
}

async function handleImport() {
  const fileEl = document.getElementById('importFile');
  const textEl = document.getElementById('importText');
  const replace = document.getElementById('importReplace')?.checked;
  const preview = document.getElementById('importPreview');

  let content = '';
  let filename = '';
  if (fileEl && fileEl.files && fileEl.files.length) {
    const file = fileEl.files[0];
    filename = file.name;
    content = await file.text();
  } else if (textEl && textEl.value.trim()) {
    content = textEl.value.trim();
  } else {
    alert('Please provide a file or paste content to import');
    return;
  }

  let items = [];
  try {
    items = parseImportContent(content, filename);
  } catch (err) {
    console.error('Import parse error', err);
    alert('Failed to parse import data. Check format.');
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    alert('No questions found in import content');
    return;
  }

  // Map imported rows to quiz question objects
  const imported = items.map((it, idx) => {
    // support rows where fields may be strings
    const question = (it.question || it.q || it.question_text || '') + '';
    const type = (it.type || 'multiple_choice') + '';
    let optionsRaw = it.options ?? it.opts ?? '';
    // if options field is an array already, keep
    const options = parseOptions(optionsRaw);
    let correct = it.correct_answer ?? it.correct ?? it.answer ?? '';
    // normalize correct to index
    const correctIdx = normalizeCorrectAnswer(correct, options);
    const points = parseInt(it.points) || 1;
    const order_index = (it.order_index !== undefined) ? parseInt(it.order_index) : idx;

    return {
      question: question,
      type: type,
      options: type === 'multiple_choice' ? options : undefined,
      correct_answer: type === 'multiple_choice' ? correctIdx : (it.sample_answer || ''),
      points: points,
      order_index: order_index
    };
  });

  if (replace) {
    quizQuestions = imported;
  } else {
    quizQuestions = quizQuestions.concat(imported);
  }

  renderQuizQuestions();
  importModal.hide();
}

// Format question type
function formatQuestionType(type) {
  const types = {
    'multiple_choice': 'Multiple Choice',
    'short_answer': 'Short Answer',
    'long_answer': 'Long Answer'
  };
  return types[type] || type;
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
