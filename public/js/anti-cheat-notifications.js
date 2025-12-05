// Anti-Cheating Notification System
// Shows random reminders about academic integrity every 5 minutes

const antiCheatMessages = [
  {
    title: "Academic Integrity Reminder",
    message: "Remember: Honesty is the foundation of learning. Cheating undermines your education.",
    icon: "shield-check"
  },
  {
    title: "Stay True to Yourself",
    message: "Your integrity is worth more than any grade. Study hard and do your best!",
    icon: "heart"
  },
  {
    title: "Build Real Knowledge",
    message: "Cheating gives you grades, but studying gives you knowledge. Choose wisely.",
    icon: "book"
  },
  {
    title: "Think Long-Term",
    message: "The real world rewards knowledge and skills, not shortcuts. Invest in yourself.",
    icon: "trophy"
  },
  {
    title: "Respect Your Effort",
    message: "You've put in the work to study. Trust yourself during exams!",
    icon: "star"
  },
  {
    title: "Academic Honor",
    message: "Your education is your responsibility. Make yourself proud with honest effort.",
    icon: "award"
  },
  {
    title: "Fair Competition",
    message: "Everyone deserves a fair chance. Keep exams honest for yourself and others.",
    icon: "people"
  },
  {
    title: "Future Success",
    message: "Skills built through honest learning last forever. Cheating only lasts until the exam ends.",
    icon: "lightbulb"
  },
  {
    title: "Trust Your Preparation",
    message: "You studied for this! Believe in your abilities and do your best honestly.",
    icon: "check-circle"
  },
  {
    title: "Character Over Grades",
    message: "Your character is defined by what you do when no one is watching. Stay honest!",
    icon: "gem"
  },
  {
    title: "Ethical Learning",
    message: "Learning with integrity prepares you for real challenges. Cheating only makes you weaker.",
    icon: "mortarboard"
  },
  {
    title: "Consequences Matter",
    message: "Academic dishonesty can have serious consequences. It's not worth the risk!",
    icon: "exclamation-triangle"
  }
];

let notificationInterval = null;
let lastNotificationTime = 0;

// Show a random anti-cheat notification
function showAntiCheatNotification() {
  const now = Date.now();
  
  // Don't show if less than 5 minutes since last notification
  if (now - lastNotificationTime < 5 * 60 * 1000) {
    return;
  }
  
  lastNotificationTime = now;
  
  // Select random message
  const randomMessage = antiCheatMessages[Math.floor(Math.random() * antiCheatMessages.length)];
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'anti-cheat-notification';
  notification.innerHTML = `
    <div class="anti-cheat-notification-content">
      <div class="anti-cheat-notification-icon">
        <i class="bi bi-${randomMessage.icon}"></i>
      </div>
      <div class="anti-cheat-notification-text">
        <strong>${randomMessage.title}</strong>
        <p>${randomMessage.message}</p>
      </div>
      <button class="anti-cheat-notification-close" onclick="this.parentElement.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 500);
  }, 15000);
}

// Initialize anti-cheat notifications
function initAntiCheatNotifications() {
  // Show first notification after 5 minutes
  setTimeout(() => {
    showAntiCheatNotification();
    
    // Then show every 5 minutes
    notificationInterval = setInterval(() => {
      showAntiCheatNotification();
    }, 5 * 60 * 1000); // 5 minutes5 * 60 * 1000
  }, 5 * 60 * 1000); // 5 minutes
}

// Start on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAntiCheatNotifications);
} else {
  initAntiCheatNotifications();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }
});
