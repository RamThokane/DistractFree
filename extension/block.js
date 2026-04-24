try {
  const params = new URLSearchParams(window.location.search);
  const siteName = params.get('site') || 'Unknown Website';
  const siteId = params.get('siteId') || '';
  const siteUrl = params.get('url') || '';
  
  document.getElementById('blocked-site').textContent = siteName;

  const timerRow = document.getElementById('timer-row');
  const timeDisplay = document.getElementById('remaining-time');

  // Poll for status every second
  const updateStatus = async () => {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, resolve);
      });
      
      if (response && response.activeSession) {
        timerRow.style.display = 'flex';
        timeDisplay.textContent = response.activeSession.remainingTime;
      } else {
        // No active session
        timerRow.style.display = 'flex';
        timeDisplay.textContent = 'Always Blocked';
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initial check and interval
  updateStatus();
  setInterval(updateStatus, 1000);

  // Unlock button
  document.getElementById('unlock-btn').addEventListener('click', async () => {
    const btn = document.getElementById('unlock-btn');
    btn.disabled = true;
    btn.textContent = 'Unlocking...';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'UNLOCK_WEBSITE', websiteId: siteId, websiteUrl: siteUrl },
          resolve
        );
      });

      if (response && response.success) {
        btn.textContent = 'Unlocked! Redirecting...';
        btn.classList.add('btn-success');
        setTimeout(() => {
          try {
            chrome.tabs.update({ url: siteUrl });
          } catch (err) {
            window.location.href = siteUrl;
          }
        }, 800);
      } else {
        btn.textContent = response?.message || 'Unlock Failed';
        setTimeout(() => {
          btn.textContent = 'Unlock for 5 Coins';
          btn.disabled = false;
        }, 3000);
      }
    } catch (e) {
      btn.textContent = 'Error occurred';
      setTimeout(() => {
        btn.textContent = 'Unlock for 5 Coins';
        btn.disabled = false;
      }, 3000);
    }
  });

  // Go back button
  document.getElementById('go-back-btn').addEventListener('click', () => {
    try {
      chrome.tabs.update({ url: 'https://www.google.com' });
    } catch (err) {
      window.location.href = 'https://www.google.com';
    }
  });

} catch (err) {
  console.error("Block page initialization failed:", err);
}
