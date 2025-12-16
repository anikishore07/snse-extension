// SNSE Side Panel JavaScript
// Basic demo wiring to look up outfits by product name

import { outfitData } from './outfit-data.js';

console.log('SNSE side panel loaded');

// Helper: Convert Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper: Fetch URL and convert to Base64
async function urlToBase64(url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error("Failed to convert image:", error);
    return null; // Return null so we can handle it
  }
}

// Helper: Get current product URL from active tab
async function getCurrentProductUrl() {
  try {
    if (!chrome.tabs) {
      console.warn('SNSE: chrome.tabs API not available');
      return null;
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0 && tabs[0].url) {
      return tabs[0].url;
    }
    return null;
  } catch (error) {
    console.error('SNSE: Error getting current product URL:', error);
    return null;
  }
}

const outfitResultEl = document.getElementById('outfit-result');
const addPickupBtn = document.getElementById('add-pickup');
const createOutfitBtn = document.getElementById('create-outfit-btn');
const generateOutfitBtn = document.getElementById('generate-outfit-btn');
const exitOutfitBtn = document.getElementById('exit-outfit-btn');
const snseLogo = document.querySelector('.main-header h1');
const pickupsListEl = document.getElementById('pickups-list');
const pickupsContainer = document.getElementById('pickups-container');
const inspirationView = document.getElementById('inspiration-view');
const pickupsView = document.getElementById('pickups-view');
const tabInspiration = document.getElementById('tab-inspiration');
const tabPickups = document.getElementById('tab-pickups');
const resultOverlay = document.getElementById('result-overlay');
const loadingStateEl = document.getElementById('loading-state');
const generatedImageEl = document.getElementById('generated-image');
const resultCloseBtn = document.getElementById('result-close-btn');
const enlargeOverlay = document.getElementById('enlarge-overlay');
const enlargeCloseBtn = document.getElementById('enlarge-close-btn');
const enlargedImageEl = document.getElementById('enlarged-image');
const productImageEl = document.getElementById('product-image');
const closetMatchesSection = inspirationView ? document.createElement('div') : null;

if (closetMatchesSection) {
  closetMatchesSection.id = 'closet-matches';
  closetMatchesSection.style.marginTop = '16px';
  closetMatchesSection.style.padding = '12px';
  closetMatchesSection.style.border = '1px solid #e0e0e0';
  closetMatchesSection.style.borderRadius = '8px';
  closetMatchesSection.style.display = 'none';
  inspirationView.appendChild(closetMatchesSection);
}

let currentTitle = null;
let currentProductImageUrl = null;
let currentProductState = null;
let selectedPickup = null;
let outfitSelection = { top: null, bottom: null, shoes: null };
let isOutfitCreationMode = false;
let userHeadshot = null; // Global variable to store headshot Base64 string

const categorizeItem = (title) => {
  if (!title) {
    return "accessory";
  }
  
  const lowerTitle = title.toLowerCase();
  
  // Top keywords
  const topKeywords = ["hoodie", "tee", "t-shirt", "shirt", "sweater", "jacket", "top", "polo", "tank"];
  if (topKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return "top";
  }
  
  // Bottom keywords
  const bottomKeywords = ["jean", "pant", "short", "jogger", "sweatpant", "bottom", "skirt", "trouser"];
  if (bottomKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return "bottom";
  }
  
  // Shoes keywords
  const shoesKeywords = ["shoe", "sneaker", "boot", "sandal", "slide", "loafer", "loafers", "flats", "flat", "croc"];
  if (shoesKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return "shoes";
  }
  
  // Default to accessory if no match
  return "accessory";
};

const renderOutfit = async (outfit, productImageUrl = null) => {
  // Get the existing product-image element
  const imgEl = document.getElementById('product-image');
  
  // Safety check: return early if element doesn't exist
  if (!imgEl) {
    console.warn('SNSE: product-image element not found');
    return;
  }

  // Clear any other content but preserve the product-image element
  const initialMessage = outfitResultEl.querySelector('p');
  if (initialMessage && initialMessage.textContent === 'Waiting for product info...') {
    initialMessage.style.display = 'none';
  }

  if (outfit) {
    const inspirationImage = outfit.outfitImage || outfit.image || null;
    console.log('SNSE: Inspiration tab image path:', inspirationImage);

    if (inspirationImage) {
      // Use existing element for outfit images too
      imgEl.src = inspirationImage;
      imgEl.alt = 'Suggested outfit';
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  } else {
    // Display product image if available, otherwise show message
    if (productImageUrl) {
      // Load Cached Look: Check storage for cached generated outfit
      const productUrl = await getCurrentProductUrl();
      let imageToDisplay = productImageUrl; // Default to original product image
      
      if (productUrl && chrome.storage?.local) {
        const cacheKey = "look_" + productUrl;
        // Use Promise to await storage check
        const cachedImage = await new Promise((resolve) => {
          chrome.storage.local.get(cacheKey, (data) => {
            if (chrome.runtime.lastError) {
              console.warn('SNSE: Error loading cached look:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(data[cacheKey] || null);
            }
          });
        });
        
        if (cachedImage) {
          // Cached outfit found - use it
          imageToDisplay = cachedImage;
        }
      }
      
      // Update existing element (cached outfit if found, otherwise original product image)
      imgEl.src = imageToDisplay;
      imgEl.alt = imageToDisplay === productImageUrl ? 'Product image' : 'Generated outfit';
      imgEl.style.display = 'block';
    } else {
      // No product image available - hide the element
      imgEl.style.display = 'none';
    }
  }

  updateClosetMatches(outfit);
};

const renderClosetMatches = (matches = []) => {
  if (!closetMatchesSection) {
    return;
  }

  closetMatchesSection.innerHTML = '';

  if (!matches.length) {
    closetMatchesSection.style.display = 'none';
    return;
  }

  closetMatchesSection.style.display = 'block';

  const heading = document.createElement('h3');
  heading.textContent = 'From Your Closet';
  heading.style.margin = '0 0 8px 0';
  heading.style.fontSize = '1rem';
  heading.style.color = '#333';
  closetMatchesSection.appendChild(heading);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';
  list.style.gridTemplateColumns = '1fr';

  matches.forEach((match) => {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '10px';

    if (match.image) {
      const img = document.createElement('img');
      img.src = match.image;
      img.alt = match.title || 'Closet item';
      img.style.width = '56px';
      img.style.height = '56px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';
      card.appendChild(img);
    }

    const label = document.createElement('span');
    label.textContent = match.title || 'Saved pickup';
    label.style.fontWeight = '500';
    card.appendChild(label);

    list.appendChild(card);
  });

  closetMatchesSection.appendChild(list);
};

const findMatchesInPickups = (currentItem) =>
  new Promise((resolve) => {
    if (
      !currentItem ||
      !Array.isArray(currentItem.compatibleCategories) ||
      !currentItem.compatibleCategories.length ||
      !chrome.storage?.local
    ) {
      resolve([]);
      return;
    }

    chrome.storage.local.get('pickups', (result) => {
      if (chrome.runtime.lastError) {
        console.warn('SNSE: Failed to read pickups', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      const pickups = result?.pickups || [];
      const matches = pickups.filter(
        (pickup) => pickup.category && currentItem.compatibleCategories.includes(pickup.category)
      );
      resolve(matches);
    });
  });

const updateClosetMatches = (currentItem) => {
  findMatchesInPickups(currentItem).then(renderClosetMatches);
};

const setActiveTab = (tab) => {
  const isInspiration = tab === 'inspiration';
  inspirationView.classList.toggle('hidden', !isInspiration);
  pickupsView.classList.toggle('hidden', isInspiration);
  tabInspiration.classList.toggle('active', isInspiration);
  tabPickups.classList.toggle('active', !isInspiration);

  if (isInspiration) {
    // Reset outfit creation mode when switching to inspiration tab
    exitOutfitCreation();
    if (currentProductState) {
      updateClosetMatches(currentProductState);
    }
  } else {
    // Show exit button if in outfit creation mode when switching to pickups tab
    if (exitOutfitBtn) {
      exitOutfitBtn.classList.toggle('hidden', !isOutfitCreationMode);
    }
  }
};

tabInspiration?.addEventListener('click', () => setActiveTab('inspiration'));
tabPickups?.addEventListener('click', () => setActiveTab('pickups'));

const createPickupItem = (item) => {
  const li = document.createElement('li');
  li.className = 'pickup-item';
  
  // Check if item should be dimmed (in outfit mode and matches current product category)
  if (isOutfitCreationMode && currentProductState && item.category === currentProductState.category) {
    li.classList.add('dimmed');
  }
  
  // Check if this item is selected (for outfit mode, check outfitSelection; otherwise check selectedPickup)
  let isSelected = false;
  if (isOutfitCreationMode) {
    const selectedForCategory = outfitSelection[item.category];
    isSelected = selectedForCategory && 
      selectedForCategory.title === item.title && 
      selectedForCategory.image === item.image;
  } else {
    isSelected = selectedPickup && 
      selectedPickup.title === item.title && 
      selectedPickup.image === item.image;
  }
  
  if (isSelected) {
    li.classList.add('selected');
  }
  
  // Click handler for selection
  li.addEventListener('click', (e) => {
    // Don't trigger selection if clicking the remove button or if dimmed
    if (e.target.classList.contains('pickup-remove-btn') || li.classList.contains('dimmed')) {
      return;
    }
    
    if (isOutfitCreationMode) {
      // Outfit creation mode: select by category
      const category = item.category;
      const selectedForCategory = outfitSelection[category];
      const isCurrentlySelected = selectedForCategory && 
        selectedForCategory.title === item.title && 
        selectedForCategory.image === item.image;
      
      if (isCurrentlySelected) {
        // Deselect
        outfitSelection[category] = null;
        li.classList.remove('selected');
      } else {
        // Deselect other items in same category
        const container = pickupsContainer || pickupsListEl;
        const allItems = container.querySelectorAll('.pickup-item');
        allItems.forEach(itemEl => {
          const itemCategory = itemEl.dataset.category;
          if (itemCategory === category) {
            itemEl.classList.remove('selected');
          }
        });
        
        // Select this item
        outfitSelection[category] = item;
        li.classList.add('selected');
      }
      
      checkOutfitReady();
    } else {
      // Normal mode: single selection
      const isCurrentlySelected = selectedPickup && 
        selectedPickup.title === item.title && 
        selectedPickup.image === item.image;
      
      if (isCurrentlySelected) {
        selectedPickup = null;
        li.classList.remove('selected');
      } else {
        const allItems = pickupsListEl.querySelectorAll('.pickup-item');
        allItems.forEach(li => li.classList.remove('selected'));
        selectedPickup = item;
        li.classList.add('selected');
      }
      
      console.log('Currently Selected:', selectedPickup);
    }
  });
  
  // Store category for easy lookup
  li.dataset.category = item.category || 'other';
  
  // Image container with remove button
  if (item.image) {
    console.log('SNSE: My Pickups image path:', item.image);
    const imageContainer = document.createElement('div');
    imageContainer.className = 'pickup-image-container';
    
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title || 'Saved outfit';
    imageContainer.appendChild(img);
    
    // Remove button (X)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'pickup-remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.setAttribute('aria-label', 'Remove item');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Clear selections if removing selected item
      if (isOutfitCreationMode) {
        Object.keys(outfitSelection).forEach(cat => {
          const selected = outfitSelection[cat];
          if (selected && selected.title === item.title && selected.image === item.image) {
            outfitSelection[cat] = null;
          }
        });
        checkOutfitReady();
      } else {
        if (selectedPickup && 
            selectedPickup.title === item.title && 
            selectedPickup.image === item.image) {
          selectedPickup = null;
        }
      }
      removePickup(item);
    });
    imageContainer.appendChild(removeBtn);
    
    li.appendChild(imageContainer);
  }

  const title = document.createElement('p');
  title.textContent = item.title || 'Unknown item';
  li.appendChild(title);

  return li;
};

const renderSection = (title, items, container) => {
  if (!items || items.length === 0) {
    return;
  }
  
  // Create category header
  const header = document.createElement('h3');
  header.className = 'category-header';
  header.textContent = title;
  container.appendChild(header);
  
  // Create grid container for this category
  const grid = document.createElement('ul');
  grid.className = 'pickups-grid';
  
  items.forEach(item => {
    const li = createPickupItem(item);
    grid.appendChild(li);
  });
  
  container.appendChild(grid);
};

const renderPickups = (items = []) => {
  // Clear the container (pickups-container)
  if (pickupsContainer) {
    pickupsContainer.innerHTML = '';
  } else {
    // Fallback to pickupsListEl if container doesn't exist
    pickupsListEl.innerHTML = '';
  }
  
  const container = pickupsContainer || pickupsListEl;
  
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'No pickups saved yet.';
    const ul = document.createElement('ul');
    ul.appendChild(li);
    container.appendChild(ul);
    return;
  }

  // Filter items by category
  const tops = items.filter(item => item.category === 'top');
  const bottoms = items.filter(item => item.category === 'bottom');
  const shoes = items.filter(item => item.category === 'shoes');
  const others = items.filter(item => !['top', 'bottom', 'shoes'].includes(item.category));
  
  // Render each category section
  renderSection('TOPS', tops, container);
  renderSection('BOTTOMS', bottoms, container);
  renderSection('SHOES', shoes, container);
  
  // Only show others if not in outfit creation mode
  if (!isOutfitCreationMode && others.length > 0) {
    renderSection('OTHER', others, container);
  }
};

const removePickup = (itemToRemove) => {
  chrome.storage?.local?.get('pickups', (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to load pickups for removal', chrome.runtime.lastError);
      return;
    }
    const existing = result?.pickups || [];
    // Remove item by matching both title and image (to handle colorways correctly)
    const updated = existing.filter((item) => 
      !(item.title === itemToRemove.title && item.image === itemToRemove.image)
    );
    
    chrome.storage.local.set({ pickups: updated }, () => {
      if (chrome.runtime.lastError) {
        console.warn('SNSE: Failed to remove pickup', chrome.runtime.lastError);
        return;
      }
      renderPickups(updated);
      console.log('SNSE: Pickup removed.');
    });
  });
};

const loadPickups = () => {
  chrome.storage?.local?.get('pickups', (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to load pickups', chrome.runtime.lastError);
      return;
    }
    renderPickups(result?.pickups || []);
  });
};

const startOutfitCreation = () => {
  if (!currentProductState) {
    console.warn('SNSE: No product selected to create outfit from.');
    return;
  }
  
  // Switch to Pickups tab
  setActiveTab('pickups');
  
  // Pre-fill outfitSelection based on current product's category
  const currentCategory = currentProductState.category;
  if (currentCategory === 'top') {
    outfitSelection.top = currentProductState;
  } else if (currentCategory === 'bottom') {
    outfitSelection.bottom = currentProductState;
  } else if (currentCategory === 'shoes') {
    outfitSelection.shoes = currentProductState;
  }
  
  // Set outfit creation mode
  isOutfitCreationMode = true;
  
  // Apply galaxy gradient to logo
  if (snseLogo) {
    snseLogo.classList.add('galaxy-gradient');
  }
  
  // Show exit button
  if (exitOutfitBtn) {
    exitOutfitBtn.classList.remove('hidden');
  }
  
  // Re-render pickups with dimmed category
  loadPickups();
  
  // Check if outfit is ready
  checkOutfitReady();
};

const exitOutfitCreation = () => {
  // Reset outfit creation mode
  isOutfitCreationMode = false;
  outfitSelection = { top: null, bottom: null, shoes: null };
  
  // Hide exit button
  if (exitOutfitBtn) {
    exitOutfitBtn.classList.add('hidden');
  }
  
  // Disable generate button
  if (generateOutfitBtn) {
    generateOutfitBtn.disabled = true;
  }
  
  // Remove galaxy gradient from logo
  if (snseLogo) {
    snseLogo.classList.remove('galaxy-gradient');
  }
  
  // Re-render pickups normally (without dimming)
  loadPickups();
};

const checkOutfitReady = () => {
  if (!generateOutfitBtn) {
    return;
  }
  
  // Enable button only if top, bottom, and shoes are all present
  const isReady = outfitSelection.top && outfitSelection.bottom && outfitSelection.shoes;
  generateOutfitBtn.disabled = !isReady;
};

const generateOutfit = async () => {
  console.log('Outfit Selection:', outfitSelection);

  if (!resultOverlay || !loadingStateEl || !generatedImageEl) {
    console.warn('SNSE: Result overlay elements not found.');
    return;
  }

  // Sanitization step: Convert URL images to Base64 before API call
  // Check and convert top image
  if (outfitSelection.top && outfitSelection.top.image && outfitSelection.top.image.startsWith('http')) {
    try {
      const base64Image = await urlToBase64(outfitSelection.top.image);
      if (base64Image) {
        outfitSelection.top.image = base64Image;
      } else {
        console.error('SNSE: Failed to convert top image to Base64');
        alert('Failed to process top image. Please try again.');
        return;
      }
    } catch (error) {
      console.error('SNSE: Error converting top image:', error);
      alert(`Failed to process top image: ${error.message || error}. Please check the console for details.`);
      return;
    }
  }

  // Check and convert bottom image
  if (outfitSelection.bottom && outfitSelection.bottom.image && outfitSelection.bottom.image.startsWith('http')) {
    try {
      const base64Image = await urlToBase64(outfitSelection.bottom.image);
      if (base64Image) {
        outfitSelection.bottom.image = base64Image;
      } else {
        console.error('SNSE: Failed to convert bottom image to Base64');
        alert('Failed to process bottom image. Please try again.');
        return;
      }
    } catch (error) {
      console.error('SNSE: Error converting bottom image:', error);
      alert(`Failed to process bottom image: ${error.message || error}. Please check the console for details.`);
      return;
    }
  }

  // Check and convert shoes image
  if (outfitSelection.shoes && outfitSelection.shoes.image && outfitSelection.shoes.image.startsWith('http')) {
    try {
      const base64Image = await urlToBase64(outfitSelection.shoes.image);
      if (base64Image) {
        outfitSelection.shoes.image = base64Image;
      } else {
        console.error('SNSE: Failed to convert shoes image to Base64');
        alert('Failed to process shoes image. Please try again.');
        return;
      }
    } catch (error) {
      console.error('SNSE: Error converting shoes image:', error);
      alert(`Failed to process shoes image: ${error.message || error}. Please check the console for details.`);
      return;
    }
  }

  console.log("Payload Ready:", outfitSelection);

  // Show overlay and loading state
  resultOverlay.classList.remove('hidden');
  loadingStateEl.classList.remove('hidden');
  generatedImageEl.classList.add('hidden');

  try {
    const { generateOutfitImage } = await import('./api-handler.js');
    const imageUrl = await generateOutfitImage(outfitSelection);
    if (!imageUrl) {
      // Error already handled in generateOutfitImage
      loadingStateEl.classList.add('hidden');
      resultOverlay.classList.add('hidden');
      return;
    }

    // Hide loading, show image in overlay
    loadingStateEl.classList.add('hidden');
    generatedImageEl.src = imageUrl;
    generatedImageEl.classList.remove('hidden');

    // Update the Display: Show generated outfit in Inspiration tab (Fitting Room)
    const imgEl = document.getElementById('product-image');
    if (imgEl) {
      imgEl.src = imageUrl;
      imgEl.alt = 'Generated outfit';
      imgEl.style.display = 'block';
    } else {
      console.warn('SNSE: product-image element not found when updating generated outfit');
    }

    // Save Generated Look: Cache the generated outfit image for this product URL
    const productUrl = await getCurrentProductUrl();
    if (productUrl && chrome.storage?.local) {
      const cacheKey = "look_" + productUrl;
      chrome.storage.local.set({ [cacheKey]: imageUrl }, () => {
        if (chrome.runtime.lastError) {
          console.warn('SNSE: Failed to save generated look cache:', chrome.runtime.lastError);
        } else {
          console.log('SNSE: Generated look cached for:', productUrl);
        }
      });
    }
    
    // CRITICAL: Do NOT update currentProductState - preserve original product image
    // currentProductState remains unchanged so "Add to Pickups" saves the individual item
  } catch (error) {
    console.error('SNSE: Error during generateOutfit:', error);
    console.error('SNSE: Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    alert(`Failed to generate outfit: ${error.message || error}. Please check the console for details.`);
    loadingStateEl.classList.add('hidden');
    resultOverlay.classList.add('hidden');
  }
};

const savePickup = async () => {
  if (!currentProductState) {
    console.warn('SNSE: No product selected to save.');
    return;
  }

  // Get the image URL from currentProductState
  const imageUrl = currentProductState.image || currentProductState.imageUrl || null;
  
  if (!imageUrl) {
    console.warn('SNSE: No image URL found in currentProductState.');
    return;
  }

  // Convert the image URL to Base64 (freeze it)
  let base64Image = imageUrl;
  
  // Only convert if it's not already a Base64 data URL
  if (!imageUrl.startsWith('data:')) {
    base64Image = await urlToBase64(imageUrl);
    if (!base64Image) {
      alert("Could not save image. Is it a valid URL?");
      return;
    }
  }

  chrome.storage?.local?.get('pickups', (result) => {
    const existing = result?.pickups || [];
    
    // Check for duplicates: require BOTH title AND image to match
    // Compare Base64 strings for duplicate detection
    const isDuplicate = existing.some((item) => 
      (item.title === currentProductState.title || item.name === currentProductState.name || item.name === currentProductState.title) && 
      item.image === base64Image
    );
    if (isDuplicate) {
      console.log('SNSE: Item already saved (same name and image).');
      return;
    }
    
    const newPickup = {
      ...currentProductState,
      image: base64Image, // Save Base64 string instead of URL
      savedAt: Date.now()
    };
    
    chrome.storage.local.set(
      { pickups: [...existing, newPickup] },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('SNSE: Failed to save pickup', chrome.runtime.lastError);
          return;
        }
        const updated = [...existing, newPickup];
        renderPickups(updated);
        // Update closet matches if this is a hardcoded item with compatibleCategories
        if (currentProductState.compatibleCategories) {
          updateClosetMatches(currentProductState);
        }
        console.log('SNSE: Pickup saved with Base64 image.');
      }
    );
  });
};

addPickupBtn?.addEventListener('click', savePickup);
createOutfitBtn?.addEventListener('click', startOutfitCreation);
generateOutfitBtn?.addEventListener('click', generateOutfit);
exitOutfitBtn?.addEventListener('click', exitOutfitCreation);

// Result overlay close handler
resultCloseBtn?.addEventListener('click', () => {
  if (resultOverlay) {
    resultOverlay.classList.add('hidden');
  }
  if (generatedImageEl) {
    generatedImageEl.src = '';
    generatedImageEl.classList.add('hidden');
  }
  if (loadingStateEl) {
    loadingStateEl.classList.add('hidden');
  }
});
resultCloseBtn?.addEventListener('click', () => {
  if (resultOverlay) {
    resultOverlay.classList.add('hidden');
  }
  if (generatedImageEl) {
    generatedImageEl.src = '';
    generatedImageEl.classList.add('hidden');
  }
  if (loadingStateEl) {
    loadingStateEl.classList.add('hidden');
  }
});
resultCloseBtn?.addEventListener('click', () => {
  if (resultOverlay) {
    resultOverlay.classList.add('hidden');
  }
  if (generatedImageEl) {
    generatedImageEl.src = '';
    generatedImageEl.classList.add('hidden');
  }
  if (loadingStateEl) {
    loadingStateEl.classList.remove('hidden');
  }
});

// Inspiration image overlay: open on product-image click, close via button
const openInspirationOverlay = () => {
  if (!enlargeOverlay || !enlargedImageEl || !productImageEl) {
    console.warn('SNSE: Inspiration overlay elements missing');
    return;
  }
  if (!productImageEl.src) {
    return; // Nothing to show
  }
  enlargedImageEl.src = productImageEl.src;
  enlargedImageEl.alt = productImageEl.alt || 'Enlarged image';
  enlargeOverlay.classList.remove('hidden');
};

const closeInspirationOverlay = () => {
  if (!enlargeOverlay) return;
  enlargeOverlay.classList.add('hidden');
};

productImageEl?.addEventListener('click', openInspirationOverlay);
enlargeCloseBtn?.addEventListener('click', closeInspirationOverlay);
enlargeOverlay?.addEventListener('click', (event) => {
  // Close when clicking the blurred backdrop, ignore clicks on the image itself
  if (event.target === enlargeOverlay) {
    closeInspirationOverlay();
  }
});

const updateFromTitle = (title, productImageUrl = null) => {
  currentTitle = title || null;
  currentProductImageUrl = productImageUrl || null;
  
  if (!title) {
    currentProductState = null;
    renderOutfit(null, productImageUrl);
    return;
  }

  // Check if title exists in outfitData (hardcoded test items)
  const outfit = outfitData[title];
  if (outfit) {
    // Hardcoded item: deep copy the outfit object and add title
    currentProductState = {
      ...outfit,
      title: title
    };
    renderOutfit(outfit, productImageUrl);
  } else {
    // Scraped/wild item: create new object
    currentProductState = {
      id: Date.now().toString(),
      name: title,
      image: productImageUrl || null,
      category: categorizeItem(title),
      outfitImage: null,
      title: title
    };
    renderOutfit(null, productImageUrl);
  }
};

const hydrateFromStorage = () => {
  if (!chrome.storage?.local) {
    console.warn('SNSE: chrome.storage.local unavailable in side panel.');
    return;
  }
  chrome.storage.local.get(['snseLastProductTitle', 'snseLastProductImageUrl', 'pickups'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to read stored data', chrome.runtime.lastError);
      return;
    }
    if (result?.snseLastProductTitle) {
      updateFromTitle(result.snseLastProductTitle, result.snseLastProductImageUrl);
    }
    renderPickups(result?.pickups || []);
  });
};

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.snseLastProductTitle) {
      const imageUrl = changes.snseLastProductImageUrl?.newValue || null;
      updateFromTitle(changes.snseLastProductTitle.newValue, imageUrl);
    }
    if (changes.snseLastProductImageUrl && currentTitle) {
      // Update image if title is already set
      updateFromTitle(currentTitle, changes.snseLastProductImageUrl.newValue);
    }
    if (changes.pickups) {
      const nextPickups = changes.pickups.newValue || [];
      renderPickups(nextPickups);
      if (currentProductState) {
        updateClosetMatches(currentProductState);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'snse-product-title' && message.title) {
    updateFromTitle(message.title, message.productImageUrl);
  }
});

// Profile functionality
const profileIcon = document.getElementById('profile-icon');
const profileOverlay = document.getElementById('profile-overlay');
const profileCloseBtn = document.getElementById('profile-close');
const headshotInput = document.getElementById('user-headshot');
const headshotPreview = document.getElementById('headshot-preview');
const profileForm = document.getElementById('profile-form');
const userGender = document.getElementById('user-gender');
const userBodyType = document.getElementById('user-body-type');
const userHeight = document.getElementById('user-height');
const userEthnicity = document.getElementById('user-ethnicity');
const userAge = document.getElementById('user-age');
const userFit = document.getElementById('user-fit');
const apiKeyInput = document.getElementById('api-key');

// Show overlay when profile icon is clicked
profileIcon?.addEventListener('click', () => {
  if (profileOverlay) {
    profileOverlay.classList.remove('hidden');
  }
});

// Hide overlay when close button is clicked
profileCloseBtn?.addEventListener('click', () => {
  if (profileOverlay) {
    profileOverlay.classList.add('hidden');
  }
});

// Handle headshot file input
headshotInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result;
      // Store Base64 string in global variable for Save Profile button
      userHeadshot = base64String;
      if (headshotPreview) {
        headshotPreview.src = base64String;
        headshotPreview.classList.remove('hidden');
      }
    };
    reader.readAsDataURL(file);
  }
});

// Save profile
profileForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Get API key from input
  const apiKey = apiKeyInput?.value || '';
  
  // Handle headshot: check tempHeadshotBase64 (userHeadshot global) vs existing storage
  const headshotBase64 = userHeadshot || (headshotPreview?.src && !headshotPreview.classList.contains('hidden') 
    ? headshotPreview.src 
    : null);
  
  // Save all profile data at root level of chrome.storage.local
  const storageData = {
    apiKey: apiKey,
    userHeadshot: headshotBase64,
    userHeight: userHeight?.value || '',
    userEthnicity: userEthnicity?.value || '',
    userAge: userAge?.value || '',
    userFit: userFit?.value || '',
    userGender: userGender?.value || '',
    userBodyType: userBodyType?.value || ''
  };

  chrome.storage?.local?.set(
    storageData,
    () => {
      if (chrome.runtime.lastError) {
        console.warn('SNSE: Failed to save profile', chrome.runtime.lastError);
      } else {
        console.log('SNSE: Profile saved successfully');
        // Close overlay after saving
        if (profileOverlay) {
          profileOverlay.classList.add('hidden');
        }
      }
    }
  );
});

// Load profile
const loadProfile = () => {
  if (!chrome.storage?.local) {
    return;
  }

  chrome.storage.local.get('snseUserProfile', (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to load profile', chrome.runtime.lastError);
      return;
    }

    const profile = result?.snseUserProfile;
    if (profile) {
      // Pre-fill form fields
      if (profile.headshot) {
        // Store in global variable and update preview
        userHeadshot = profile.headshot;
        if (headshotPreview) {
          headshotPreview.src = profile.headshot;
          headshotPreview.classList.remove('hidden');
        }
      }
      if (profile.gender && userGender) {
        userGender.value = profile.gender;
      }
      if (profile.bodyType && userBodyType) {
        userBodyType.value = profile.bodyType;
      }
      if (profile.height && userHeight) {
        userHeight.value = profile.height;
      }
      if (profile.ethnicity && userEthnicity) {
        userEthnicity.value = profile.ethnicity;
      }
      if (profile.age && userAge) {
        userAge.value = profile.age;
      }
      if (profile.fit && userFit) {
        userFit.value = profile.fit;
      }
      if (profile.apiKey && apiKeyInput) {
        apiKeyInput.value = profile.apiKey;
      }
    }
  });
};

// One-time cleanup: Migrate old 'snsePickups' data to 'pickups' and remove old key
const cleanupOldPickupsData = () => {
  if (!chrome.storage?.local) {
    return;
  }
  chrome.storage.local.get(['snsePickups', 'pickups'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to check for old data', chrome.runtime.lastError);
      return;
    }
    // If old data exists and new data doesn't, migrate it
    if (result?.snsePickups && !result?.pickups) {
      chrome.storage.local.set({ pickups: result.snsePickups }, () => {
        if (!chrome.runtime.lastError) {
          console.log('SNSE: Migrated old pickups data to new format');
          // Remove old key
          chrome.storage.local.remove('snsePickups', () => {
            console.log('SNSE: Removed old snsePickups key');
          });
        }
      });
    } else if (result?.snsePickups) {
      // Old data exists but new data also exists - just remove old key
      chrome.storage.local.remove('snsePickups', () => {
        console.log('SNSE: Removed old snsePickups key');
      });
    }
  });
};

// Run cleanup on load
cleanupOldPickupsData();

hydrateFromStorage();
loadProfile();

