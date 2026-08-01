// ASilva Chatbot Widget for Alvin Silva's Site
// Logo: https://asilvainnovations.github.io/alvin-silva/assets/logo-192.png

(function() {
  // Configuration
  const CONFIG = {
    botName: 'ASilva',
    logoUrl: 'https://asilvainnovations.github.io/alvin-silva/assets/logo-192.png',
    chatUrl: 'https://www.kimi.com/bot/chat/19f6b511-b922-86c1-8000-0000fc88d7e5'
    primaryColor: '#02583f', // Deep Green from your branding
    position: 'bottom-right', // bottom-right | bottom-left
    greeting: 'Hi! I am ASilva, Alvin Silva\'s AI assistant. How can I help you today?'
  };

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    #asilva-widget-container {
      position: fixed;
      ${CONFIG.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : 'left: 20px; bottom: 20px;'}
      z-index: 9999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #asilva-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${CONFIG.primaryColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(2, 88, 63, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }
    #asilva-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(2, 88, 63, 0.4);
    }
    #asilva-toggle img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }
    #asilva-chat-window {
      position: absolute;
      ${CONFIG.position === 'bottom-right' ? 'right: 0; bottom: 80px;' : 'left: 0; bottom: 80px;'}
      width: 380px;
      height: 500px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    #asilva-chat-window.active {
      display: flex;
    }
    #asilva-header {
      background: ${CONFIG.primaryColor};
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #asilva-header img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255,255,255,0.3);
    }
    #asilva-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    #asilva-header p {
      margin: 0;
      font-size: 12px;
      opacity: 0.8;
    }
    #asilva-iframe {
      flex: 1;
      border: none;
      width: 100%;
    }
    #asilva-close {
      position: absolute;
      ${CONFIG.position === 'bottom-right' ? 'left: 12px;' : 'right: 12px;'}
      top: 16px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    @media (max-width: 480px) {
      #asilva-chat-window {
        width: calc(100vw - 40px);
        height: 70vh;
      }
    }
  `;
  document.head.appendChild(styles);

  // Create widget HTML
  const container = document.createElement('div');
  container.id = 'asilva-widget-container';
  container.innerHTML = `
    <button id="asilva-toggle" aria-label="Chat with ASilva">
      <img src="${CONFIG.logoUrl}" alt="ASilva Logo">
    </button>
    <div id="asilva-chat-window">
      <div id="asilva-header">
        <button id="asilva-close">×</button>
        <img src="${CONFIG.logoUrl}" alt="ASilva">
        <div>
          <h3>${CONFIG.botName}</h3>
          <p>Alvin Silva's AI Assistant</p>
        </div>
      </div>
      <iframe 
        id="asilva-iframe" 
        src="${CONFIG.chatUrl}" 
        title="ASilva Chat"
        sandbox="allow-scripts allow-same-origin allow-popups"
      ></iframe>
    </div>
  `;
  document.body.appendChild(container);

  // Event listeners
  const toggle = document.getElementById('asilva-toggle');
  const chatWindow = document.getElementById('asilva-chat-window');
  const closeBtn = document.getElementById('asilva-close');

  toggle.addEventListener('click', () => {
    chatWindow.classList.toggle('active');
  });

  closeBtn.addEventListener('click', () => {
    chatWindow.classList.remove('active');
  });

  // Optional: Show greeting after 5 seconds
  setTimeout(() => {
    if (!chatWindow.classList.contains('active')) {
      // You could add a tooltip here
    }
  }, 5000);
})();
