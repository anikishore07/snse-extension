// Content script to detect product titles on Abercrombie product pages
(() => {
  const selectors = [
    'h1',
    '[data-test="product-title"]',
    '.product-title',
    '.pdp-title',
    '.product-name'
  ];

  const findTitle = () =>
    selectors
      .map((selector) => document.querySelector(selector))
      .find((el) => el && el.textContent.trim().length);

  const persistTitle = (title) => {
    if (!chrome.storage?.local) {
      console.warn('SNSE: chrome.storage.local unavailable; cannot persist title.');
      return;
    }
    chrome.storage.local.set(
      {
        snseLastProductTitle: title
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('SNSE: Failed to persist title', chrome.runtime.lastError);
        }
      }
    );
  };

  const sendTitle = (titleElement) => {
    const title = titleElement.textContent.trim();
    console.log('SNSE Found:', title);
    persistTitle(title);
    chrome.runtime.sendMessage({
      type: 'snse-product-title',
      title
    });
  };

  const pollForTitle = (attempt = 0) => {
    const titleElement = findTitle();
    if (titleElement) {
      sendTitle(titleElement);
      return;
    }
    if (attempt < 10) {
      setTimeout(() => pollForTitle(attempt + 1), 300);
    } else {
      console.warn('SNSE: Product title not found after retries.');
    }
  };

  pollForTitle();
})();
