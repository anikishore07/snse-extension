// Content script to detect product titles on Abercrombie product pages
(() => {
  const titleSelectors = [
    'h1',
    '[data-test="product-title"]',
    '.product-title',
    '.pdp-title',
    '.product-name'
  ];

  const imageSelectors = [
    '[data-test="product-image"] img',
    '.product-image img',
    '.pdp-image img',
    '.product-photo img',
    '.product-gallery img',
    'img[alt*="product"]',
    'img[alt*="Product"]'
  ];

  const findTitle = () =>
    titleSelectors
      .map((selector) => document.querySelector(selector))
      .find((el) => el && el.textContent.trim().length);

  const findProductImage = () => {
    // Try selectors first
    for (const selector of imageSelectors) {
      const img = document.querySelector(selector);
      if (img) {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
          return src;
        }
      }
    }

    // Fallback: find largest image in product container
    const productContainers = [
      '[data-test="product-details"]',
      '.product-details',
      '.pdp-container',
      '.product-container',
      'main'
    ];

    for (const containerSelector of productContainers) {
      const container = document.querySelector(containerSelector);
      if (container) {
        const images = Array.from(container.querySelectorAll('img'));
        if (images.length > 0) {
          // Find the largest image by natural dimensions
          const validImages = images
            .map((img) => ({
              img,
              src: img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'),
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            }))
            .filter((item) => {
              const src = item.src || '';
              return (
                item.src &&
                item.width > 200 &&
                item.height > 200 &&
                !src.includes('logo') &&
                !src.includes('icon') &&
                !src.includes('placeholder') &&
                !src.includes('avatar')
              );
            })
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));

          if (validImages.length > 0) {
            return validImages[0].src;
          }
        }
      }
    }

    return null;
  };

  const persistTitle = (title, imageUrl) => {
    if (!chrome.storage?.local) {
      console.warn('SNSE: chrome.storage.local unavailable; cannot persist title.');
      return;
    }
    const data = {
      snseLastProductTitle: title
    };
    if (imageUrl) {
      data.snseLastProductImageUrl = imageUrl;
    }
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.warn('SNSE: Failed to persist title', chrome.runtime.lastError);
      }
    });
  };

  const sendTitle = (titleElement) => {
    const title = titleElement.textContent.trim();
    const productImageUrl = findProductImage();
    console.log('SNSE Found:', title);
    if (productImageUrl) {
      console.log('SNSE Image URL:', productImageUrl);
    }
    persistTitle(title, productImageUrl);
    chrome.runtime.sendMessage({
      type: 'snse-product-title',
      title,
      productImageUrl
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
