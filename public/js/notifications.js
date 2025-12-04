// Notification System for New Messages, Subjects, Courses, and Reviewers

let notificationPermission = null;
let lastCheckedCounts = {
  messages: 0,
  subjects: 0,
  courses: 0,
  reviewers: 0
};

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  // Check if already granted
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }

  // Check if already denied
  if (Notification.permission === 'denied') {
    notificationPermission = 'denied';
    return false;
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    
    if (permission === 'granted') {
      // Show confirmation notification
      showNotification('Notifications Enabled', {
        body: 'You will now receive updates about new messages, subjects, courses, and reviewers!',
        icon: '/images/logo.png',
        badge: '/images/logo.png',
        tag: 'notification-enabled'
      });
      
      // Store preference
      localStorage.setItem('notificationsEnabled', 'true');
      return true;
    } else {
      localStorage.setItem('notificationsEnabled', 'false');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Show notification
function showNotification(title, options = {}) {
  if (Notification.permission !== 'granted') return;

  const defaultOptions = {
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);
    
    // Handle notification click
    notification.onclick = function(event) {
      event.preventDefault();
      window.focus();
      
      // Navigate based on tag
      if (options.tag) {
        if (options.tag.includes('message')) {
          // Open message modal
          if (typeof toggleMessageModal === 'function') {
            toggleMessageModal();
          }
        } else if (options.tag.includes('subject')) {
          window.location.href = '/subject.html';
        } else if (options.tag.includes('course')) {
          window.location.href = '/index.html';
        } else if (options.tag.includes('reviewer')) {
          // Extract subject ID from data attribute or URL
          if (options.data && options.data.subjectId) {
            window.location.href = `/reviewer.html?subject=${options.data.subjectId}`;
          }
        }
      }
      
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

// Check for new messages
async function checkNewMessages() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase not available for checkNewMessages');
    return;
  }
  
  try {
    const { count, error } = await supabase
      .from('anonymous_messages')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastCheckedCounts.messages) {
      const newCount = count - lastCheckedCounts.messages;
      
      // Show notification
      showNotification('New Messages', {
        body: `${newCount} new ${newCount === 1 ? 'message' : 'messages'} in the community!`,
        tag: 'new-messages',
        data: { count: newCount }
      });
      
      // Update badge
      if (typeof updateMessageBadge === 'function') {
        updateMessageBadge(newCount);
      }
    }

    lastCheckedCounts.messages = count;
  } catch (error) {
    console.error('Error checking new messages:', error);
  }
}

// Check for new subjects
async function checkNewSubjects() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase not available for checkNewSubjects');
    return;
  }
  
  try {
    const { count, error } = await supabase
      .from('subjects')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastCheckedCounts.subjects) {
      const newCount = count - lastCheckedCounts.subjects;
      
      // Fetch the new subjects to get titles
      const { data: newSubjects } = await supabase
        .from('subjects')
        .select('title')
        .order('created_at', { ascending: false })
        .limit(newCount);

      const subjectNames = newSubjects ? newSubjects.map(s => s.title).join(', ') : 'New subjects';
      
      showNotification('New Subjects Available', {
        body: `${newCount} new ${newCount === 1 ? 'subject' : 'subjects'} added: ${subjectNames}`,
        tag: 'new-subjects',
        data: { count: newCount }
      });
    }

    lastCheckedCounts.subjects = count;
  } catch (error) {
    console.error('Error checking new subjects:', error);
  }
}

// Check for new courses
async function checkNewCourses() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase not available for checkNewCourses');
    return;
  }
  
  try {
    const { count, error } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastCheckedCounts.courses) {
      const newCount = count - lastCheckedCounts.courses;
      
      // Fetch the new courses to get titles
      const { data: newCourses } = await supabase
        .from('courses')
        .select('title')
        .order('created_at', { ascending: false })
        .limit(newCount);

      const courseNames = newCourses ? newCourses.map(c => c.title).join(', ') : 'New courses';
      
      showNotification('New Courses Available', {
        body: `${newCount} new ${newCount === 1 ? 'course' : 'courses'} added: ${courseNames}`,
        tag: 'new-courses',
        data: { count: newCount }
      });
    }

    lastCheckedCounts.courses = count;
  } catch (error) {
    console.error('Error checking new courses:', error);
  }
}

// Check for new reviewers
async function checkNewReviewers() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase not available for checkNewReviewers');
    return;
  }
  
  try {
    const { count, error } = await supabase
      .from('reviewers')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count > lastCheckedCounts.reviewers) {
      const newCount = count - lastCheckedCounts.reviewers;
      
      // Fetch the new reviewers to get titles
      const { data: newReviewers } = await supabase
        .from('reviewers')
        .select('title, subject_id')
        .order('created_at', { ascending: false })
        .limit(newCount);

      if (newReviewers && newReviewers.length > 0) {
        const reviewerTitles = newReviewers.map(r => r.title).join(', ');
        
        showNotification('New Reviewers Uploaded', {
          body: `${newCount} new ${newCount === 1 ? 'reviewer' : 'reviewers'}: ${reviewerTitles}`,
          tag: 'new-reviewers',
          data: { count: newCount, subjectId: newReviewers[0].subject_id }
        });
      }
    }

    lastCheckedCounts.reviewers = count;
  } catch (error) {
    console.error('Error checking new reviewers:', error);
  }
}

// Load initial counts without showing notifications
async function loadInitialCounts() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase not available for loadInitialCounts');
    return;
  }
  
  try {
    // Load all counts in parallel
    const [messages, subjects, courses, reviewers] = await Promise.all([
      supabase.from('anonymous_messages').select('*', { count: 'exact', head: true }),
      supabase.from('subjects').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('reviewers').select('*', { count: 'exact', head: true })
    ]);
    
    // Set initial counts
    if (!messages.error) lastCheckedCounts.messages = messages.count || 0;
    if (!subjects.error) lastCheckedCounts.subjects = subjects.count || 0;
    if (!courses.error) lastCheckedCounts.courses = courses.count || 0;
    if (!reviewers.error) lastCheckedCounts.reviewers = reviewers.count || 0;
    
    console.log('Initial notification counts loaded:', lastCheckedCounts);
  } catch (error) {
    console.error('Error loading initial counts:', error);
  }
}

// Check all updates
async function checkAllUpdates() {
  if (Notification.permission !== 'granted') return;

  await Promise.all([
    checkNewMessages(),
    checkNewSubjects(),
    checkNewCourses(),
    checkNewReviewers()
  ]);
}

// Show notification permission prompt
function showNotificationPrompt() {
  // Check if user already responded
  const hasResponded = localStorage.getItem('notificationPromptShown');
  if (hasResponded === 'true') return;

  // Check if already granted
  if (Notification.permission === 'granted') {
    localStorage.setItem('notificationPromptShown', 'true');
    return;
  }

  // Create custom notification prompt
  const promptHTML = `
    <div id="notificationPrompt" class="notification-prompt">
      <div class="notification-prompt-content">
        <button type="button" class="notification-prompt-close" onclick="dismissNotificationPrompt()">
          <i class="bi bi-x-lg"></i>
        </button>
        <div class="notification-prompt-icon">
          <i class="bi bi-bell-fill"></i>
        </div>
        <h6 class="notification-prompt-title">Stay Updated!</h6>
        <p class="notification-prompt-text">
          Get notified about new messages, subjects, courses, and reviewers uploaded to the platform.
        </p>
        <div class="notification-prompt-buttons">
          <button class="btn btn-pink btn-sm" onclick="enableNotifications()">
            <i class="bi bi-bell-fill"></i> Enable Notifications
          </button>
          <button class="btn btn-outline-secondary btn-sm" onclick="dismissNotificationPrompt()">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  `;

  // Add to page after a delay
  setTimeout(() => {
    if (!document.body) return;
    document.body.insertAdjacentHTML('beforeend', promptHTML);
    
    // Show with animation
    setTimeout(() => {
      const prompt = document.getElementById('notificationPrompt');
      if (prompt) {
        prompt.classList.add('show');
      }
    }, 100);
  }, 3000); // Show after 3 seconds
}

// Enable notifications
async function enableNotifications() {
  const granted = await requestNotificationPermission();
  
  if (granted) {
    dismissNotificationPrompt();
    // Start checking for updates
    startNotificationChecks();
  } else {
    alert('Notification permission was denied. You can enable it in your browser settings.');
  }
}

// Dismiss notification prompt
function dismissNotificationPrompt() {
  const prompt = document.getElementById('notificationPrompt');
  if (prompt) {
    prompt.classList.remove('show');
    setTimeout(() => prompt.remove(), 300);
  }
  localStorage.setItem('notificationPromptShown', 'true');
}

// Start periodic checks for updates
function startNotificationChecks() {
  // Load initial counts first
  loadInitialCounts();
  
  // Then check every 30 seconds
  setInterval(checkAllUpdates, 5000);
}

// Initialize notifications
function initNotifications() {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    return;
  }

  // If already granted, start checks
  if (Notification.permission === 'granted') {
    localStorage.setItem('notificationPromptShown', 'true');
    if (typeof supabase !== 'undefined') {
      startNotificationChecks();
    } else {
      setTimeout(() => {
        if (typeof supabase !== 'undefined') {
          startNotificationChecks();
        }
      }, 1000);
    }
  } else if (Notification.permission === 'default') {
    // Show custom prompt
    showNotificationPrompt();
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  initNotifications();
}

// Expose functions globally
window.enableNotifications = enableNotifications;
window.dismissNotificationPrompt = dismissNotificationPrompt;
window.requestNotificationPermission = requestNotificationPermission;
window.showNotificationPrompt = showNotificationPrompt;
window.showNotification = showNotification; // Expose for testing

// Enhanced test notification function
window.testNotification = function() {
  console.log('=== Notification Test ===');
  console.log('Browser supports notifications:', 'Notification' in window);
  console.log('Permission status:', Notification.permission);
  
  if (!('Notification' in window)) {
    console.error('❌ This browser does not support notifications');
    alert('Your browser does not support notifications');
    return;
  }
  
  if (Notification.permission === 'denied') {
    console.error('❌ Notification permission is DENIED');
    alert('Notifications are blocked. Please enable them in your browser settings.');
    return;
  }
  
  if (Notification.permission === 'default') {
    console.warn('⚠️ Permission not yet requested');
    console.log('Requesting permission...');
    Notification.requestPermission().then(permission => {
      console.log('Permission result:', permission);
      if (permission === 'granted') {
        sendTestNotification();
      }
    });
    return;
  }
  
  if (Notification.permission === 'granted') {
    console.log('✅ Permission granted, sending test notification...');
    sendTestNotification();
  }
};

function sendTestNotification() {
  try {
    const notification = new Notification('🎉 Test Notification', {
      body: 'Success! Your notifications are working correctly.',
      icon: '/images/logo.png',
      badge: '/images/logo.png',
      tag: 'test-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    });
    
    notification.onclick = function() {
      console.log('Notification clicked!');
      window.focus();
      this.close();
    };
    
    console.log('✅ Test notification created successfully!');
    console.log('Notification object:', notification);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    alert('Error creating notification: ' + error.message);
  }
}

window.resetNotificationPrompt = function() {
  localStorage.removeItem('notificationPromptShown');
  showNotificationPrompt();
  console.log('Notification prompt reset and shown');
};

// Debug function to check notification status
window.checkNotificationStatus = function() {
  console.log('=== Notification Status ===');
  console.log('Supported:', 'Notification' in window);
  console.log('Permission:', Notification.permission);
  console.log('Prompt shown:', localStorage.getItem('notificationPromptShown'));
  console.log('Enabled:', localStorage.getItem('notificationsEnabled'));
  console.log('Last checked counts:', lastCheckedCounts);
  console.log('Supabase loaded:', typeof supabase !== 'undefined');
};
