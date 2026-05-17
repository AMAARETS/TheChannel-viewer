/**
 * Apartment Rental Banner - Ra'avad Bnei Brak - Luxury Silver & Gold
 */

(function() {
  // --- הגדרות ---
  const CONFIG = {
    email: 'DG4107983@GMAIL.COM',
    subject: encodeURIComponent('לגבי הדירה בראב"ד'),
    // קישור ישיר לג'ימייל
    gmailLink: 'https://mail.google.com/mail/?view=cm&fs=1&to=DG4107983@GMAIL.COM&su=' + encodeURIComponent('לגבי הדירה בראב"ד'),
    scrollDuration: 50 
  };

  const MESSAGES = [
    '🏠 <strong>דירה להשכרה בבני ברק:</strong> רחוב ראב"ד, קומה 3.',
    '✨ <strong>מפרט הדירה:</strong> 3 חדרים, כשישים מ"ר, יפה ושמורה מאוד.',
    '🌬️ <strong>יתרונות:</strong> 2 כיווני אוויר, ממוזגת, מוארת ונעימה.',
    '💰 <strong>מחיר אטרקטיבי:</strong> 4,500 ש"ח בלבד!'
  ];

  function createTickerItems() {
    return MESSAGES.map(msg => `<span class="apt-ticker-item">${msg}</span>`).join('');
  }

  // --- עיצוב (CSS) ---
  const styles = `
    .apt-banner-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 85px; /* מעט גבוה יותר לפונט גדול */
      padding: 0;
      box-sizing: border-box;
      /* עיצוב כסף יוקרתי ובהיר */
      background: linear-gradient(90deg, #e0e0e0 0%, #ffffff 50%, #d1d1d1 100%);
      color: #333;
      font-family: 'Assistant', 'Segoe UI', sans-serif;
      z-index: 9997;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      direction: rtl;
      overflow: hidden;
      border-radius: 6px;
      border: 2px solid #d4af37; /* מסגרת זהב עדינה */
    }

    /* כפתור סגירה */
    .apt-close-btn {
        position: absolute;
        top: 4px;
        right: 6px;
        z-index: 10010;
        background: rgba(0, 0, 0, 0.1);
        border: none;
        color: #666;
        font-size: 11px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    .apt-close-btn:hover { background: #c0392b; color: white; }

    /* חלק ימני קבוע */
    .apt-static-right {
        display: flex;
        align-items: center;
        padding: 0 20px;
        background: rgba(212, 175, 55, 0.1); /* רקע זהב שקוף */
        height: 100%;
        flex-shrink: 0;
        z-index: 10001;
        border-left: 2px solid #d4af37;
    }

    .apt-main-title { 
        font-size: 24px; /* פונט גדול */
        font-weight: 800; 
        color: #b8860b; /* צבע זהב כהה לטקסט */
        line-height: 1.1; 
        margin-left: 15px; 
    }
    
    /* כפתור ג'ימייל */
    .apt-btn-contact {
        background: #d4af37;
        background: linear-gradient(135deg, #d4af37 0%, #f1c40f 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 30px;
        font-weight: bold;
        font-size: 16px;
        white-space: nowrap;
        cursor: pointer;
        text-decoration: none;
        box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        transition: transform 0.2s;
    }
    .apt-btn-contact:hover { transform: scale(1.05); filter: brightness(1.1); }

    /* טקסט רץ - תיקון המרווחים */
    .apt-ticker-area { 
        flex-grow: 1; 
        overflow: hidden; 
        display: flex; 
        align-items: center; 
    }
    
    .apt-ticker-track { 
        display: flex; 
        width: fit-content; 
        animation: apt-scroll-rtl ${CONFIG.scrollDuration}s linear infinite; 
    }
    
    .apt-ticker-item { 
        white-space: nowrap; 
        font-size: 20px; /* פונט גדול ובולט */
        padding-left: 150px; 
        color: #444;
        font-weight: 500;
    }
    
    .apt-ticker-item strong { 
        color: #000; 
        border-bottom: 2px solid #d4af37;
    }

    /* כפתור "לפרסום" בצד שמאל */
    .apt-adv-container {
        display: flex;
        align-items: center;
        padding: 0 20px;
        height: 100%;
        flex-shrink: 0;
        z-index: 10001;
    }

    .apt-adv-button {
        background: white;
        border: 1px solid #d4af37;
        color: #b8860b;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .apt-adv-button:hover {
        background: #fdf2d0;
        transform: translateY(-2px);
    }

    /* אנימציה זהה למקור להצגה מיידית */
    @keyframes apt-scroll-rtl { 
        from { transform: translateX(0); } 
        to { transform: translateX(100%); } 
    }

    @media (max-width: 768px) {
        .apt-main-title { font-size: 18px; }
        .apt-adv-container, .apt-btn-contact { display: none; }
        .apt-ticker-item { font-size: 16px; padding-left: 80px; }
    }
  `;

  function init() {
    const adContainer = document.getElementById('ad-placement-container');
    if (!adContainer) return;

    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);

    const bannerHtml = `
      <div id="apt-banner" class="apt-banner-wrapper">
        <button id="apt-close-btn" class="apt-close-btn">✕</button>

        <!-- חלק ימני -->
        <div class="apt-static-right">
          <span class="apt-main-title">להשכרה בבני ברק</span>
          <a href="${CONFIG.gmailLink}" target="_blank" class="apt-btn-contact">פנו במייל</a>
        </div>

        <!-- אמצע: טקסט רץ -->
        <div class="apt-ticker-area">
          <div class="apt-ticker-track">
            ${createTickerItems()}
            ${createTickerItems()}
          </div>
        </div>

        <!-- צד שמאל: כפתור לפרסום -->
        <div class="apt-adv-container">
          <div id="apt-adv-btn" class="apt-adv-button">
            לפרסום<br>לחץ כאן
          </div>
        </div>
      </div>
    `;

    adContainer.innerHTML = bannerHtml;

    const banner = document.getElementById('apt-banner');
    const closeBtn = document.getElementById('apt-close-btn');
    const advBtn = document.getElementById('apt-adv-btn');

    // סגירת באנר
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      banner.style.display = 'none';
    });

    // כפתור לפרסום (שומר על המבנה המקורי)
    advBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.theChannel && typeof window.theChannel.navigateTo === 'function') {
        window.theChannel.navigateTo('contact', {});
      } else {
        window.open(CONFIG.gmailLink, '_blank');
      }
    });

    // לחיצה על כל הבאנר פותחת ג'ימייל
    banner.addEventListener('click', (e) => {
      if (!e.target.closest('#apt-close-btn') && !e.target.closest('#apt-adv-btn')) {
        window.open(CONFIG.gmailLink, '_blank');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();