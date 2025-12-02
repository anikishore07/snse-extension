// SNSE Side Panel JavaScript
// Basic demo wiring to look up outfits by product name

import { outfitData } from './outfit-data.js';

console.log('SNSE side panel loaded');

const outfitResultEl = document.getElementById('outfit-result');
const addPickupBtn = document.getElementById('add-pickup');
const pickupsListEl = document.getElementById('pickups-list');
const inspirationView = document.getElementById('inspiration-view');
const pickupsView = document.getElementById('pickups-view');
const tabInspiration = document.getElementById('tab-inspiration');
const tabPickups = document.getElementById('tab-pickups');
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
  const shoesKeywords = ["shoe", "sneaker", "boot", "sandal", "slide", "loafer", "flats"];
  if (shoesKeywords.some(keyword => lowerTitle.includes(keyword))) {
    return "shoes";
  }
  
  // Default to accessory if no match
  return "accessory";
};

const renderOutfit = (outfit, productImageUrl = null) => {
  outfitResultEl.innerHTML = '';
  if (outfit) {
    const inspirationImage = outfit.outfitImage || outfit.image || null;
    console.log('SNSE: Inspiration tab image path:', inspirationImage);

    if (inspirationImage) {
      const img = document.createElement('img');
      img.src = inspirationImage;
      img.alt = 'Suggested outfit';
      outfitResultEl.appendChild(img);
    }

    const caption = document.createElement('p');
    caption.textContent = 'Here is an outfit idea for this product.';
    outfitResultEl.appendChild(caption);
  } else {
    // Display product image if available, otherwise show message
    if (productImageUrl) {
      const img = document.createElement('img');
      img.src = productImageUrl;
      img.alt = 'Product image';
      outfitResultEl.appendChild(img);
      const caption = document.createElement('p');
      caption.textContent = 'Product image from page.';
      outfitResultEl.appendChild(caption);
    } else {
      const message = document.createElement('p');
      message.textContent = 'No outfit ideas yet for this item.';
      outfitResultEl.appendChild(message);
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

  if (isInspiration && currentProductState) {
    updateClosetMatches(currentProductState);
  }
};

tabInspiration?.addEventListener('click', () => setActiveTab('inspiration'));
tabPickups?.addEventListener('click', () => setActiveTab('pickups'));

const renderPickups = (items = []) => {
  pickupsListEl.innerHTML = '';
  
  // Add grid class to the list
  pickupsListEl.className = 'pickups-grid';
  
  if (!items.length) {
    pickupsListEl.className = '';
    const li = document.createElement('li');
    li.textContent = 'No pickups saved yet.';
    pickupsListEl.appendChild(li);
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'pickup-item';
    
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
        removePickup(item);
      });
      imageContainer.appendChild(removeBtn);
      
      li.appendChild(imageContainer);
    }

    const title = document.createElement('p');
    title.textContent = item.title || 'Unknown item';
    li.appendChild(title);

    pickupsListEl.appendChild(li);
  });
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

const savePickup = () => {
  if (!currentProductState) {
    console.warn('SNSE: No product selected to save.');
    return;
  }
  chrome.storage?.local?.get('pickups', (result) => {
    const existing = result?.pickups || [];
    // Check for duplicates: require BOTH title AND image to match
    const isDuplicate = existing.some((item) => 
      item.title === currentProductState.title && 
      item.image === currentProductState.image
    );
    if (isDuplicate) {
      console.log('SNSE: Item already saved (same name and image).');
      return;
    }
    const newPickup = {
      ...currentProductState,
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
        console.log('SNSE: Pickup saved.');
      }
    );
  });
};

addPickupBtn?.addEventListener('click', savePickup);

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
const userDescription = document.getElementById('user-description');
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
  
  const profileData = {
    headshot: headshotPreview?.src && !headshotPreview.classList.contains('hidden') 
      ? headshotPreview.src 
      : null,
    gender: userGender?.value || '',
    bodyType: userBodyType?.value || '',
    description: userDescription?.value || '',
    apiKey: apiKeyInput?.value || ''
  };

  chrome.storage?.local?.set(
    { snseUserProfile: profileData },
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
      if (profile.headshot && headshotPreview) {
        headshotPreview.src = profile.headshot;
        headshotPreview.classList.remove('hidden');
      }
      if (profile.gender && userGender) {
        userGender.value = profile.gender;
      }
      if (profile.bodyType && userBodyType) {
        userBodyType.value = profile.bodyType;
      }
      if (profile.description && userDescription) {
        userDescription.value = profile.description;
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

