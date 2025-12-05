const urlParams = new URLSearchParams(window.location.search);
const reviewerId = urlParams.get('id');
const subjectId = urlParams.get('subject_id');

let quill;
let questionModal;
let quizQuestions = [];
let currentQuestionIndex = null;
let optionCounter = 2;
let importModal;
let previewModal;

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
  previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
  const importFileEl = document.getElementById('importFile');
  if (importFileEl) importFileEl.addEventListener('change', (e) => {
    const preview = document.getElementById('importPreview');
    if (preview) preview.textContent = `Selected file: ${importFileEl.files && importFileEl.files.length ? importFileEl.files[0].name : ''}`;
  });

// Table modal bootstrap instance (kept in closure)
let tableModalInstance = null;

// helper to find available table module
const getTableModule = () => {
  try {
    return (quill && (quill.getModule('better-table') || quill.getModule('table'))) || null;
  } catch (e) {
    return null;
  }
};

// expose functions to global so inline onclick handlers work
window.showTableInsertModal = function() {
  const modalEl = document.getElementById('tableModal');
  if (!tableModalInstance) tableModalInstance = new bootstrap.Modal(modalEl, { focus: false });
  document.getElementById('tableRows').value = 4; // default 4
  document.getElementById('tableCols').value = 4;
  // blur the currently focused element (usually the trigger) to avoid focus being inside the modal while aria-hidden is true
  try { if (document.activeElement) document.activeElement.blur(); } catch (e) {}

  // show modal without letting Bootstrap auto-focus during the show transition
  tableModalInstance.show();

  // after modal is visible, set focus to the first focusable element inside it
  const onShown = () => {
    try {
      const focusable = modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
      else modalEl.focus();
    } catch (e) {}
    modalEl.removeEventListener('shown.bs.modal', onShown);
  };
  modalEl.addEventListener('shown.bs.modal', onShown);
};

window.insertTableFromModal = function() {
  const rows = Math.max(1, parseInt(document.getElementById('tableRows').value) || 4);
  const cols = Math.max(1, parseInt(document.getElementById('tableCols').value) || 4);
  try {
    const tableModule = getTableModule();
    if (tableModule && typeof tableModule.insertTable === 'function') {
      tableModule.insertTable(rows, cols);
    } else if (quill && quill.getModule('table') && typeof quill.getModule('table').insertTable === 'function') {
      quill.getModule('table').insertTable(rows, cols);
    } else {
      // fallback: insert a plain HTML table into the editor using the html-embed blot
      const sel = quill.getSelection(true);
      const idx = sel ? sel.index : quill.getLength();
      let html = '<table border="1" style="border-collapse:collapse;width:100%;">';
      for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          html += '<td>&nbsp;</td>';
        }
        html += '</tr>';
      }
      html += '</table>';

      try {
        if (quill && quill.insertEmbed && window.__htmlEmbedRegistered) {
          quill.insertEmbed(idx, 'html-embed', html, 'api');
          // move cursor after embed
          quill.setSelection(idx + 1, 0, 'api');
        } else {
          // last resort: paste raw HTML (may be sanitized by Quill)
          quill.clipboard.dangerouslyPasteHTML(idx, html + '<p></p>');
        }
      } catch (e) {
        // fallback to raw paste if embed insert fails
        quill.clipboard.dangerouslyPasteHTML(idx, html + '<p></p>');
      }
    }
  } catch (err) {
    console.error('Insert table failed', err);
    alert('Failed to insert table');
  }
  if (tableModalInstance) tableModalInstance.hide();
};

// Quick table actions: merge/unmerge, insert/remove rows/columns
window.tableAction = function(action) {
  try {
    const tableModule = getTableModule();
    if (tableModule) {
      // prefer using table module APIs when available
      switch (action) {
        case 'insertRowAbove':
          if (typeof tableModule.insertRowAbove === 'function') tableModule.insertRowAbove();
          else if (typeof tableModule.insertRow === 'function') tableModule.insertRow(true);
          break;
        case 'insertRowBelow':
          if (typeof tableModule.insertRowBelow === 'function') tableModule.insertRowBelow();
          else if (typeof tableModule.insertRow === 'function') tableModule.insertRow(false);
          break;
        case 'insertColumnLeft':
          if (typeof tableModule.insertColumnLeft === 'function') tableModule.insertColumnLeft();
          else if (typeof tableModule.insertColumn === 'function') tableModule.insertColumn(true);
          break;
        case 'insertColumnRight':
          if (typeof tableModule.insertColumnRight === 'function') tableModule.insertColumnRight();
          else if (typeof tableModule.insertColumn === 'function') tableModule.insertColumn(false);
          break;
        case 'removeRow':
          if (typeof tableModule.removeRow === 'function') tableModule.removeRow();
          break;
        case 'removeColumn':
          if (typeof tableModule.removeColumn === 'function') tableModule.removeColumn();
          break;
        case 'merge':
          if (typeof tableModule.mergeCells === 'function') tableModule.mergeCells();
          break;
        case 'unmerge':
          if (typeof tableModule.unmergeCells === 'function') tableModule.unmergeCells();
          break;
        default:
          console.warn('Unknown table action', action);
      }
      return;
    }

    // Fallback DOM-based table manipulation when no table module is available
    const sel = document.getSelection();
    const anchor = sel && sel.anchorNode;
    const findAncestor = (node, tag) => {
      while (node && node !== document) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === tag) return node;
        node = node.parentNode;
      }
      return null;
    };

    const table = findAncestor(anchor, 'table');
    if (!table) {
      alert('No table found at the cursor. Place the caret inside a table cell.');
      return;
    }

    const cell = findAncestor(anchor, 'td') || findAncestor(anchor, 'th');
    const row = cell ? cell.parentNode : null;
    const rows = Array.from(table.rows);
    const rowIndex = row ? rows.indexOf(row) : -1;
    const cellIndex = cell ? Array.prototype.indexOf.call(row.children, cell) : -1;

    const focusCell = (targetCell) => {
      try {
        const range = document.createRange();
        range.selectNodeContents(targetCell);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        targetCell.focus && targetCell.focus();
      } catch (e) {}
    };

    switch (action) {
      case 'insertRowAbove': {
        if (rowIndex < 0) return alert('Cannot determine current row');
        const cols = rows[0].cells.length;
        const newRow = table.insertRow(rowIndex);
        for (let i = 0; i < cols; i++) newRow.insertCell(i).innerHTML = '&nbsp;';
        focusCell(newRow.cells[Math.max(0, cellIndex)]);
        break;
      }
      case 'insertRowBelow': {
        if (rowIndex < 0) return alert('Cannot determine current row');
        const cols = rows[0].cells.length;
        const newRow = table.insertRow(rowIndex + 1);
        for (let i = 0; i < cols; i++) newRow.insertCell(i).innerHTML = '&nbsp;';
        focusCell(newRow.cells[Math.max(0, cellIndex)]);
        break;
      }
      case 'insertColumnLeft': {
        if (cellIndex < 0) return alert('Cannot determine current column');
        rows.forEach(r => {
          const c = r.insertCell(cellIndex);
          c.innerHTML = '&nbsp;';
        });
        // focus the cell in same row
        const target = table.rows[rowIndex].cells[cellIndex];
        if (target) focusCell(target);
        break;
      }
      case 'insertColumnRight': {
        if (cellIndex < 0) return alert('Cannot determine current column');
        rows.forEach(r => {
          const idx = Math.min(r.cells.length, cellIndex + 1);
          const c = r.insertCell(idx);
          c.innerHTML = '&nbsp;';
        });
        const target = table.rows[rowIndex].cells[cellIndex + 1];
        if (target) focusCell(target);
        break;
      }
      case 'removeRow': {
        if (rowIndex < 0) return alert('Cannot determine current row');
        table.deleteRow(rowIndex);
        break;
      }
      case 'removeColumn': {
        if (cellIndex < 0) return alert('Cannot determine current column');
        rows.forEach(r => { if (r.cells[cellIndex]) r.deleteCell(cellIndex); });
        break;
      }
      case 'merge':
      case 'unmerge':
        alert('Merge/unmerge is only available when using the table plugin.');
        break;
      default:
        console.warn('Unknown table action', action);
    }
  } catch (err) {
    console.error('Table action failed', err);
    alert('Table action failed: ' + (err.message || err));
  }
};
  
  // Initialize Quill editor
  // Register quill-better-table module (if loaded) to provide richer table support
  if (window.Quill) {
    let bt = window.QuillBetterTable || window.QuillBetterTableModule || window.betterTable || null;
    if (bt && bt.default) bt = bt.default;
    // some bundles export an object with a property 'QuillBetterTable' or 'BetterTable'
    if (bt && typeof bt === 'object' && (bt.QuillBetterTable || bt.BetterTable)) bt = bt.QuillBetterTable || bt.BetterTable;
    var registeredBetterTable = false;
    if (bt) {
      try {
        Quill.register({ 'modules/better-table': bt }, true);
        registeredBetterTable = true;
      } catch (e) {
        console.warn('Failed to register better-table module', e);
      }
    }
  }

  // Debug: expose registration status for quick diagnostics
  try {
    console.debug('better-table registered:', !!registeredBetterTable);
    window.__registeredBetterTable = !!registeredBetterTable;
  } catch (e) {}

  // Build modules config dynamically depending on available modules
  const modulesConfig = {
    toolbar: {
        container: [
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'align': [] }],
          ['link', 'image', 'formula', 'table'],
          ['clean']
        ],
        handlers: {
          // Insert a simple 3x3 table via quill-better-table when toolbar 'table' clicked
          'table': function() {
            try {
              const range = this.quill.getSelection();
              const tableModule = this.quill.getModule('better-table');
              if (tableModule && typeof tableModule.insertTable === 'function') {
                tableModule.insertTable(3, 3);
              } else if (this.quill.getModule('table')) {
                // fallback to built-in table module (if present)
                this.quill.getModule('table').insertTable(3, 3);
              } else {
                alert('Table module not available');
              }
            } catch (err) {
              console.error('Insert table failed', err);
            }
          }
        }
      }
  };

  // include better-table config only if the module was registered successfully
  if (typeof registeredBetterTable !== 'undefined' && registeredBetterTable) {
    modulesConfig['better-table'] = {
      operationMenu: {
        items: {
          unmergeCells: true,
          insertRowAbove: true,
          insertRowBelow: true,
          insertColumnLeft: true,
          insertColumnRight: true,
          removeRow: true,
          removeColumn: true,
          removeTable: true
        }
      }
    };
  }

  // Register a simple HTML embed blot so we can embed raw HTML (tables) when table plugin is not present
  try {
    const BlockEmbed = Quill.import && Quill.import('blots/block/embed');
    if (BlockEmbed) {
      class HtmlEmbed extends BlockEmbed {
        static create(value) {
          const node = super.create();
          node.innerHTML = value || '';
          return node;
        }
        static value(node) {
          return node.innerHTML;
        }
      }
      HtmlEmbed.blotName = 'html-embed';
      HtmlEmbed.tagName = 'div';
      Quill.register(HtmlEmbed, true);
      window.__htmlEmbedRegistered = true;
    }
  } catch (e) {
    console.warn('Failed to register html-embed blot', e);
  }

  // enable formula module (requires KaTeX loaded in the page)
  modulesConfig.formula = true;

  quill = new Quill('#editor', {
    theme: 'snow',
    modules: modulesConfig,
    placeholder: 'Write your reviewer content here... You can add text, code blocks, tables, images, formulas, and more!'
  });

  // Debug: show available table module (if any)
  try {
    console.debug('quill table module:', getTableModule());
    window.__quillTableModule = getTableModule();
  } catch (e) {}

  // Intercept paste to perform reliable auto-conversion (headers, bullets, bold)
  quill.root.addEventListener('paste', (e) => {
    try {
      const clipboardData = (e.clipboardData || window.clipboardData);
      const text = clipboardData.getData('text/plain');
      if (!text) return; // allow default if no plain text
      e.preventDefault();

      const sel = quill.getSelection(true);
      let insertIndex = sel ? sel.index : quill.getLength();

      const lines = text.split(/\r?\n/);
      // Insert each line with formatting
      lines.forEach((rawLine, lineIdx) => {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trimStart();
        const leadingSpaces = line.length - line.replace(/^\s+/, '').length;

        const isHeader = trimmed.startsWith('### ');
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        // compute content without marker
        let content = line;
        if (isHeader) content = line.replace(/^(\s*)###\s+/, '$1');
        else if (isBullet) content = line.replace(/^(\s*)[-*]\s+/, '$1');

        // Insert inline text handling bold markers
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let m;
        while ((m = boldRegex.exec(content)) !== null) {
          const before = content.slice(lastIndex, m.index);
          if (before) {
            quill.insertText(insertIndex, before, {}, 'api');
            insertIndex += before.length;
          }
          const boldText = m[1] || '';
          if (boldText) {
            quill.insertText(insertIndex, boldText, { bold: true }, 'api');
            insertIndex += boldText.length;
          }
          lastIndex = m.index + m[0].length;
        }
        const tail = content.slice(lastIndex);
        if (tail) {
          quill.insertText(insertIndex, tail, {}, 'api');
          insertIndex += tail.length;
        }

        // Insert newline and apply block formats
        // For the last line, don't force an extra newline if original didn't have trailing newline
        const addNewline = (lineIdx < lines.length - 1);
        if (addNewline) {
          quill.insertText(insertIndex, '\n', {}, 'api');
          // apply block formatting to the line we just inserted
          const lineStart = insertIndex - (content.length);
          if (isHeader) {
            try { quill.formatLine(lineStart, 1, { header: 3 }, 'api'); } catch (e) {}
          } else if (isBullet) {
            try { quill.formatLine(lineStart, 1, { list: 'bullet' }, 'api'); } catch (e) {}
          }
          insertIndex += 1; // account for newline
        }
      });

      // move cursor to end of inserted content
      quill.setSelection(insertIndex, 0, 'api');
    } catch (err) {
      console.error('Paste handler error', err);
      // fallback: allow default paste
    }
  });
  


  
  
  if (reviewerId) {
    document.getElementById('pageTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Reviewer';
    loadReviewer();
  } else if (!subjectId) {
    alert('Subject ID is required');
    window.location.href = '/admin/dashboard.html';
  }
});

  // (text-change handler is registered during initialization after Quill is created)

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
    window.location.href = '/admin/subject-reviewers.html';
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
      const quizzesToInsert = quizQuestions.map((q, index) => {
        // Ensure correct_answer is stored as index (number), not the option text
        let correctAnswer = q.correct_answer;
        if (typeof correctAnswer === 'string' && q.options && Array.isArray(q.options)) {
          // If it's a string, try to find its index in options
          const idx = q.options.findIndex(opt => String(opt) === correctAnswer);
          if (idx !== -1) {
            correctAnswer = idx;
          } else if (/^\d+$/.test(correctAnswer)) {
            // If it's a numeric string, convert to number
            correctAnswer = parseInt(correctAnswer);
          }
        }
        
        return {
          reviewer_id: revId,
          question: q.question,
          type: q.type,
          options: q.options ? JSON.stringify(q.options) : null,
          correct_answer: typeof correctAnswer === 'number' ? correctAnswer : 0,
          points: q.points,
          order_index: index
        };
      });

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

// Show preview modal with rendered reviewer content and quiz preview
function showPreviewModal() {
  const title = document.getElementById('reviewerTitle').value.trim();
  const contentHtml = quill ? quill.root.innerHTML : '';
  const container = document.getElementById('previewContent');
  if (!container) return;

  let html = '';
  if (title) html += `<h2 class="text-pink">${escapeHtml(title)}</h2>`;
  html += `<div class="mb-3">${contentHtml}</div>`;

  if (quizQuestions && quizQuestions.length) {
    html += '<hr><h4>Quiz Preview</h4>';
    quizQuestions.forEach((q, i) => {
      html += `<div class="mb-3"><strong>Q${i+1}.</strong> ${escapeHtml(q.question || '')}`;
      if (q.type === 'multiple_choice') {
        html += '<div class="ms-3 mt-2">';
        (Array.isArray(q.options) ? q.options : []).forEach((opt, idx) => {
          const mark = (q.correct_answer != null && q.correct_answer == idx) ? '✓' : '○';
          html += `<div>${mark} ${escapeHtml(opt)}</div>`;
        });
        html += '</div>';
      } else if (q.correct_answer) {
        html += `<div class="ms-3 mt-2"><small class="text-muted">Sample answer: ${escapeHtml(q.correct_answer)}</small></div>`;
      }
      html += '</div>';
    });
  }

  container.innerHTML = html;
  previewModal.show();
}

// Download/print preview as PDF using browser print
function downloadPreviewPdf() {
  const content = document.getElementById('previewContent');
  if (!content) return;
  const w = window.open('', '_blank');
  const docHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="p-4">${content.innerHTML}</body></html>`;
  w.document.open();
  w.document.write(docHtml);
  w.document.close();
  w.focus();
  // give it a moment to render, then print
  setTimeout(() => {
    w.print();
  }, 300);
}
