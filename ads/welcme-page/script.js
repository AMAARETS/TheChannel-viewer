// ads/welcome-page/script.js

(function() {
    console.log("Welcome-page script is now running!");

    /**
     * פונקציה ראשית שמופעלת כשה-DOM מוכן.
     */
    function initialize() {
        // קבלת הפרמטרים מה-URL
        const params = new URLSearchParams(window.location.search);
        const userName = params.get('user') || 'אורח';
        const campaign = params.get('campaign') || 'לא צוין';

        // עדכון התוכן הדינאמי ב-HTML
        const userNameElement = document.getElementById('user-name-placeholder');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }

        const campaignElement = document.getElementById('campaign-id-placeholder');
        if (campaignElement) {
            campaignElement.textContent = campaign;
        }

        // הוספת אירוע לחיצה לכפתור
        const button = document.getElementById('welcome-button');
        if (button) {
            button.addEventListener('click', function() {
                alert(`!שלום, ${userName}\n.תודה שלחצת על הכפתור בקמפיין '${campaign}'`);
            });
        }
    }

    // חשוב להמתין לאירוע DOMContentLoaded כדי לוודא שכל האלמנטים
    // מה-HTML כבר קיימים בדף לפני שמנסים לגשת אליהם.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // במקרה שה-DOM כבר נטען (נדיר, אבל יכול לקרות)
        initialize();
    }

})();
