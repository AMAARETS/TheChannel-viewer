// סקריפט לניווט בין המדריכים
(function() {
  'use strict';

  function initializeHelpPage() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.help-section');

    if (!navTabs.length || !sections.length) {
      console.error('Help page elements not found!');
      return;
    }

    navTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const targetSection = this.getAttribute('data-section');

        // הסרת active מכל הטאבים והסקציות
        navTabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        // הוספת active לטאב ולסקציה הנבחרים
        this.classList.add('active');
        const targetElement = document.getElementById(targetSection + '-section');
        if (targetElement) {
          targetElement.classList.add('active');
        }

        // גלילה לראש הדף
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // טיפול בכפתור צור קשר
  function initializeContactButton() {
    const contactButton = document.getElementById('contact-button');
    if (contactButton) {
      contactButton.addEventListener('click', function() {
        // שימוש ב-theChannel API שזמין ב-window הגלובלי
        if (window.theChannel && typeof window.theChannel.navigateTo === 'function') {
          window.theChannel.navigateTo('contact');
        } else {
          console.error('theChannel API not available');
        }
      });
    }
  }

  // המתן לטעינת ה-DOM לפני הרצת הסקריפט
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initializeHelpPage();
      initializeContactButton();
    });
  } else {
    initializeHelpPage();
    initializeContactButton();
  }
})();
