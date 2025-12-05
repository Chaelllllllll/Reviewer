// Dark Mode Toggle Functionality
(function() {
  'use strict';

  // Check for saved dark mode preference or default to light mode
  const currentMode = localStorage.getItem('darkMode') || 'light';
  
  // Apply saved preference on page load
  if (currentMode === 'dark') {
    document.body.classList.add('dark-mode');
  }

  // Create and add dark mode toggle button
  function createDarkModeToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'dark-mode-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
    toggleBtn.setAttribute('title', 'Toggle dark mode');
    
    // Set initial icon
    updateToggleIcon(toggleBtn);
    
    // Add click event listener
    toggleBtn.addEventListener('click', toggleDarkMode);
    
    // Add to page
    document.body.appendChild(toggleBtn);
  }

  // Update toggle button icon based on current mode
  function updateToggleIcon(btn) {
    const isDark = document.body.classList.contains('dark-mode');
    btn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
  }

  // Toggle dark mode
  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    
    // Save preference
    localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
    
    // Update icon
    const toggleBtn = document.querySelector('.dark-mode-toggle');
    if (toggleBtn) {
      updateToggleIcon(toggleBtn);
    }

    // Dispatch custom event for other scripts to respond if needed
    window.dispatchEvent(new CustomEvent('darkModeToggled', { 
      detail: { isDark } 
    }));
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDarkModeToggle);
  } else {
    createDarkModeToggle();
  }
})();
