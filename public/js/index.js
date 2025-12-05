// In-memory cache of courses for filtering
let allCourses = [];

// Initialize user navigation
async function initializeUserNav() {
  const navbarMenu = document.getElementById('navbarMenu');
  if (!navbarMenu) return;
  
  const profile = await getCurrentUserProfile();
  
  if (profile) {
    const profilePic = profile.profile_picture_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.display_name || profile.email);
    
    // Add profile and logout buttons
    navbarMenu.innerHTML += `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${profilePic}" alt="Profile" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
          <span>${profile.display_name || 'User'}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
          <li><a class="dropdown-item" href="/profile.html"><i class="bi bi-person-circle me-2"></i>Profile</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
        </ul>
      </li>
    `;
    
    // Add logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      window.location.href = '/login.html';
    });
  }
}

// Load and display all courses with their subjects
async function loadCourses() {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        *,
        subjects (
          id,
          title,
          description,
          color
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('coursesContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';

    // cache courses for search
    allCourses = courses || [];

    // initialize search handlers
    initCourseSearch();

    if (!courses || courses.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-inbox" style="font-size: 4rem; color: var(--pink-primary);"></i>
          <h3 class="mt-3 text-muted">No courses available yet</h3>
          <p class="text-muted">Check back later for new content!</p>
        </div>
      `;
      return;
    }

    // Create course cards with collapsible subjects
    container.innerHTML = courses.map(course => {
      const subjects = course.subjects || [];
      const subjectCount = subjects.length;
      
      return `
      <div class="col-12 mb-4">
        <div class="card">
          <div class="card-header" style="background-color: ${course.color || '#fd77ad'};">
            <div class="d-flex justify-content-between align-items-center">
              <h4 class="mb-0 text-white">
                <i class="bi bi-collection-fill"></i> ${escapeHtml(course.title)}
              </h4>
              <button 
                class="btn btn-light btn-sm" 
                type="button"
                data-bs-toggle="collapse" 
                data-bs-target="#course-${course.id}" 
                aria-expanded="false"
              > View Subjects (${subjectCount})
              </button>
            </div>
            ${course.description ? `<p class="mb-0 mt-2 text-white small">${escapeHtml(course.description)}</p>` : ''}
          </div>
          <div class="collapse" id="course-${course.id}">
            <div class="card-body">
              ${subjects.length > 0 ? `
                <div class="row">
                  ${subjects.map(subject => `
                    <div class="col-md-6 col-lg-4 mb-3">
                      <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header" style="background-color: ${subject.color || '#fd77ad'};">
                          <h6 class="mb-0 text-white">
                            <i class="bi bi-book"></i> ${escapeHtml(subject.title)}
                          </h6>
                        </div>
                        <div class="card-body d-flex flex-column">
                          <p class="card-text flex-grow-1 small">${escapeHtml(subject.description || 'No description available.')}</p>
                          <a href="/subject.html?id=${subject.id}" class="btn btn-pink btn-sm w-100 mt-2 text-light subject-link" data-subject-id="${subject.id}">
                            <i class="bi bi-eye"></i> View Reviewers
                          </a>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="text-center py-4 text-muted">
                  <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                  <p class="mt-2 mb-0">No subjects in this course yet</p>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `}).join('');

  } catch (error) {
    console.error('Error loading courses:', error);
    const container = document.getElementById('coursesContainer');
    const spinner = document.getElementById('loadingSpinner');
    
    spinner.style.display = 'none';
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i> 
          Failed to load courses. Please try again later.
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

// Load courses when page loads
document.addEventListener('DOMContentLoaded', loadCourses);

// Initialize search input behavior
function initCourseSearch() {
  const searchEl = document.getElementById('courseSearch');
  const clearBtn = document.getElementById('clearSearch');
  if (!searchEl) return;

  // debounce helper
  let t = null;
  searchEl.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      filterCourses(q);
    }, 180);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchEl.value = '';
      clearBtn.style.display = 'none';
      filterCourses('');
      searchEl.focus();
    });
  }
}

function filterCourses(q) {
  const container = document.getElementById('coursesContainer');
  if (!container) return;
  
  const items = allCourses.filter(c => {
    if (!q) return true;
    const hay = `${c.title} ${c.description || ''}`.toLowerCase();
    // Also search in subjects
    const subjectMatch = (c.subjects || []).some(s => {
      const subHay = `${s.title} ${s.description || ''}`.toLowerCase();
      return subHay.indexOf(q) !== -1;
    });
    return hay.indexOf(q) !== -1 || subjectMatch;
  });

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search" style="font-size: 4rem; color: var(--pink-primary);"></i>
        <h3 class="mt-3 text-muted">No matching courses</h3>
        <p class="text-muted">Try a different search term.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(course => {
    const subjects = course.subjects || [];
    const subjectCount = subjects.length;
    
    return `
    <div class="col-12 mb-4">
      <div class="card">
        <div class="card-header" style="background-color: ${course.color || '#fd77ad'};">
          <div class="d-flex justify-content-between align-items-center">
            <h4 class="mb-0 text-white">
              <i class="bi bi-collection-fill"></i> ${escapeHtml(course.title)}
            </h4>
            <button 
              class="btn btn-light btn-sm" 
              type="button" 
              data-bs-toggle="collapse" 
              data-bs-target="#course-${course.id}" 
              aria-expanded="false"
            >
              <i class="bi bi-eye"></i> View Subjects (${subjectCount})
            </button>
          </div>
          ${course.description ? `<p class="mb-0 mt-2 text-white small">${escapeHtml(course.description)}</p>` : ''}
        </div>
        <div class="collapse" id="course-${course.id}">
          <div class="card-body">
            ${subjects.length > 0 ? `
              <div class="row">
                ${subjects.map(subject => `
                  <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card h-100 border-0 shadow-sm">
                      <div class="card-header" style="background-color: ${subject.color || '#fd77ad'};">
                        <h6 class="mb-0 text-white">
                          <i class="bi bi-book"></i> ${escapeHtml(subject.title)}
                        </h6>
                      </div>
                      <div class="card-body d-flex flex-column">
                        <p class="card-text flex-grow-1 small">${escapeHtml(subject.description || 'No description available.')}</p>
                        <a href="/subject.html?id=${subject.id}" class="btn btn-pink btn-sm w-100 mt-2 text-light">
                          <i class="bi bi-eye"></i> View Reviewers
                        </a>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="text-center py-4 text-muted">
                <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                <p class="mt-2 mb-0">No subjects in this course yet</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  // Add click event listeners to subject links
  setTimeout(() => {
    document.querySelectorAll('.subject-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Check if user is authenticated
        const user = await getCurrentUser();
        if (!user) {
          // Show auth modal
          const authModal = new bootstrap.Modal(document.getElementById('authModal'));
          authModal.show();
          return;
        }
        
        // Check if email is verified
        const profile = await getCurrentUserProfile();
        if (!profile || !profile.email_verified) {
          // Show auth modal
          const authModal = new bootstrap.Modal(document.getElementById('authModal'));
          authModal.show();
          return;
        }
        
        // User is authenticated and verified, allow navigation
        window.location.href = link.href;
      });
    });
  }, 100);
}

