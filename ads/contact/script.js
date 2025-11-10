// ads/contact/script.js
(function() {
    'use strict';

    function initializeContactForm() {
        const form = document.getElementById('contact-form');
        const submitBtn = document.getElementById('submit-btn');
        const messageContainer = document.getElementById('form-message-container');

        if (!form || !submitBtn || !messageContainer) {
            console.error('Contact form elements not found!');
            return;
        }

        form.addEventListener('submit', async (event) => {
            // --- FIX: Prevent the default form submission which causes a page refresh ---
            event.preventDefault();
            // --------------------------------------------------------------------------

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // ולידציה בסיסית
            if (!data.name || !data.email || !data.message) {
                showMessage('נא למלא את כל השדות.', 'error');
                return;
            }

            // עדכוני UI בזמן שליחה
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = 'שולח...';
            hideMessage();

            try {
                const response = await fetch('https://formsubmit.co/ajax/click.go.script@gmail.com', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        ...data,
                        _subject: 'פנייה חדשה מהאתר TheChannel!'
                    })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok.');
                }

                await response.json(); // קריאה לתוצאה
                showMessage('הפנייה נשלחה בהצלחה! ניצור קשר בהקדם.', 'success');
                form.reset();

            } catch (error) {
                console.error('Form submission error:', error);
                showMessage('אירעה שגיאה. אנא נסו שוב מאוחר יותר.', 'error');
            } finally {
                // החזרת ה-UI למצב רגיל
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = 'שלח פנייה';
            }
        });

        function showMessage(text, type) {
            messageContainer.textContent = text;
            messageContainer.className = `form-message ${type}`;
            messageContainer.style.display = 'block';
        }

        function hideMessage() {
            messageContainer.style.display = 'none';
        }
    }

    // המתן לטעינת ה-DOM לפני הרצת הסקריפט
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContactForm);
    } else {
        initializeContactForm();
    }
})();
