let courseModal;
let deleteModal;
let deleteCourseId = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  courseModal = new bootstrap.Modal(document.getElementById('courseModal'));
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  
  loadCourses();
});

// Handle logout
async function handleLogout() {
  await signOut();
  window.location.href = '/admin/login.html';
}

// Load all courses with subject counts
async function loadCourses() {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        *,
        subjects (count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('coursesTable');
    const noCourses = document.getElementById('noCourses');
    const tbody = document.getElementById('coursesTableBody');

    spinner.style.display = 'none';

    if (!courses || courses.length === 0) {
      noCourses.style.display = 'block';
      return;
    }

    table.style.display = 'block';
    
    tbody.innerHTML = courses.map(course => {
      const subjectCount = course.subjects?.[0]?.count || 0;
      
      return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
              <div style="width: 20px; height: 20px; background-color: ${course.color || '#fd77ad'}; border-radius: 5px; margin-right: 10px;"></div>
            <strong>${escapeHtml(course.title)}</strong>
          </div>
        </td>
        <td>${escapeHtml(course.description || '-')}</td>
        <td><span class="badge bg-pink text-dark">${subjectCount} subject${subjectCount !== 1 ? 's' : ''}</span></td>
        <td>${new Date(course.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <div class="btn-group" role="group">
            <a href="/admin/course-subjects.html?id=${course.id}" class="btn btn-sm btn-outline-pink">
              <i class="bi bi-eye"></i> View Subjects
            </a>
            <button class="btn btn-sm btn-outline-pink" onclick="editCourse('${course.id}')">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCourse('${course.id}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `}).join('');

  } catch (error) {
    console.error('Error loading courses:', error);
    alert('Failed to load courses. Please refresh the page.');
  }
}

// Show create course modal
function showCreateCourseModal() {
  document.getElementById('courseModalTitle').textContent = 'Create Course';
  document.getElementById('courseForm').reset();
  document.getElementById('courseId').value = '';
  courseModal.show();
}

// Edit course
async function editCourse(id) {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseTitle').value = course.title;
    document.getElementById('courseDescription').value = course.description || '';
    
    courseModal.show();

  } catch (error) {
    console.error('Error loading course:', error);
    alert('Failed to load course details.');
  }
}

// Save course (create or update)
async function saveCourse() {
  const id = document.getElementById('courseId').value;
  const title = document.getElementById('courseTitle').value.trim();
  const description = document.getElementById('courseDescription').value.trim();
  const color = '#fd77ad';

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    if (id) {
      // Update
      const { error } = await supabase
        .from('courses')
        .update({ title, description, color, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } else {
      // Create
      const { error } = await supabase
        .from('courses')
        .insert([{ title, description, color }]);

      if (error) throw error;
    }

    courseModal.hide();
    loadCourses();

  } catch (error) {
    console.error('Error saving course:', error);
    alert('Failed to save course. Please try again.');
  }
}

// Delete course
function deleteCourse(id) {
  deleteCourseId = id;
  deleteModal.show();
}

// Confirm delete
async function confirmDelete() {
  if (!deleteCourseId) return;

  try {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', deleteCourseId);

    if (error) throw error;

    deleteModal.hide();
    deleteCourseId = null;
    loadCourses();

  } catch (error) {
    console.error('Error deleting course:', error);
    alert('Failed to delete course. Please try again.');
  }
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
