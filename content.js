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

  const getProductImage = () => {
    // Get all img tags on the page
    const allImages = Array.from(document.querySelectorAll('img'));
    
    if (allImages.length === 0) {
      return null;
    }

    // Helper function to extract image source
    const getImageSrc = (img) => {
      return img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || null;
    };

    // Helper function to check if image should be excluded
    const shouldExclude = (altText) => {
      const lowerAlt = (altText || '').toLowerCase();
      return lowerAlt.includes('swatch') || lowerAlt.includes('color');
    };

    // Priority 1: Find image where alt text (lowercase) contains "prod image"
    for (const img of allImages) {
      const alt = (img.alt || '').toLowerCase();
      const src = getImageSrc(img);
      if (src && alt.includes('prod image') && !shouldExclude(img.alt)) {
        console.log('SNSE: Found image (Priority 1 - "prod image"):', src);
        return src;
      }
    }

    // Priority 2: Find image where alt text contains "product"
    for (const img of allImages) {
      const alt = (img.alt || '').toLowerCase();
      const src = getImageSrc(img);
      if (src && alt.includes('product') && !shouldExclude(img.alt)) {
        console.log('SNSE: Found image (Priority 2 - "product"):', src);
        return src;
      }
    }

    // Fallback: First image in main product gallery container
    const gallerySelectors = [
      '.product-gallery',
      '.slick-track',
      '.swiper-wrapper',
      '[data-test="product-gallery"]',
      '.product-images',
      '.pdp-images',
      '[data-test="product-details"]',
      '.product-details',
      '.pdp-container',
      '.product-container'
    ];

    for (const gallerySelector of gallerySelectors) {
      const container = document.querySelector(gallerySelector);
      if (container) {
        const images = Array.from(container.querySelectorAll('img'));
        if (images.length > 0) {
          for (const img of images) {
            const src = getImageSrc(img);
            if (src && !shouldExclude(img.alt)) {
              console.log('SNSE: Found image (Fallback - gallery container):', src);
              return src;
            }
          }
        }
      }
    }

    // Last resort: first valid image (excluding swatches/colors)
    for (const img of allImages) {
      const src = getImageSrc(img);
      if (src && !shouldExclude(img.alt)) {
        console.log('SNSE: Found image (Last resort):', src);
        return src;
      }
    }

    console.warn('SNSE: No valid product image found');
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

  const sendTitle = (titleElement, productImageUrl = null) => {
    const title = titleElement.textContent.trim();
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

  let lastImageUrl = null;
  let debounceTimer = null;

  const checkAndUpdateImage = () => {
    const titleElement = findTitle();
    if (!titleElement) {
      return;
    }

    const newImageUrl = getProductImage();
    if (newImageUrl && newImageUrl !== lastImageUrl) {
      const title = titleElement.textContent.trim();
      console.log('SNSE: Image URL changed, updating:', newImageUrl);
      lastImageUrl = newImageUrl;
      
      persistTitle(title, newImageUrl);
      chrome.runtime.sendMessage({
        type: 'snse-product-title',
        title,
        productImageUrl: newImageUrl
      });
    }
  };

  const pollForTitle = (attempt = 0) => {
    const titleElement = findTitle();
    if (titleElement) {
      const title = titleElement.textContent.trim();
      const productImageUrl = getProductImage();
      lastImageUrl = productImageUrl;
      sendTitle(titleElement, productImageUrl);
      return;
    }
    if (attempt < 10) {
      setTimeout(() => pollForTitle(attempt + 1), 300);
    } else {
      console.warn('SNSE: Product title not found after retries.');
    }
  };

  // Set up MutationObserver for SPA updates
  const startObserver = () => {
    const observer = new MutationObserver(() => {
      // Debounce: wait 500ms after last change
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        checkAndUpdateImage();
      }, 500);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-lazy-src']
    });

    return observer;
  };

  // Initialize: start polling and observer
  if (document.body) {
    startObserver();
    pollForTitle();
  } else {
    // Wait for body to be available
    const bodyReadyObserver = new MutationObserver(() => {
      if (document.body) {
        startObserver();
        pollForTitle();
        bodyReadyObserver.disconnect();
      }
    });
    bodyReadyObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
