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

    chrome.storage.local.get('snsePickups', (result) => {
      if (chrome.runtime.lastError) {
        console.warn('SNSE: Failed to read pickups', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      const pickups = result?.snsePickups || [];
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

  if (isInspiration && currentTitle) {
    const currentItem = outfitData[currentTitle];
    updateClosetMatches(currentItem);
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

  items.forEach((item) => {
    const li = document.createElement('li');
    
    if (item.image) {
      console.log('SNSE: My Pickups image path:', item.image);
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title || 'Saved outfit';
      li.appendChild(img);
    }

    const title = document.createElement('p');
    title.textContent = item.title || 'Unknown item';
    li.appendChild(title);

    pickupsListEl.appendChild(li);
  });
};

const loadPickups = () => {
  chrome.storage?.local?.get('snsePickups', (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to load pickups', chrome.runtime.lastError);
      return;
    }
    renderPickups(result?.snsePickups || []);
  });
};

const savePickup = () => {
  if (!currentTitle) {
    console.warn('SNSE: No product selected to save.');
    return;
  }
  chrome.storage?.local?.get('snsePickups', (result) => {
    const existing = result?.snsePickups || [];
    if (existing.some((item) => item.title === currentTitle)) {
      console.log('SNSE: Item already saved.');
      return;
    }
    const outfit = outfitData[currentTitle];
    if (!outfit) {
      console.warn('SNSE: No outfit data found for current selection.');
      return;
    }
    const newPickup = {
      title: currentTitle,
      ...outfit,
      savedAt: Date.now()
    };
    chrome.storage.local.set(
      { snsePickups: [...existing, newPickup] },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('SNSE: Failed to save pickup', chrome.runtime.lastError);
          return;
        }
        const updated = [...existing, newPickup];
        renderPickups(updated);
        updateClosetMatches(outfit);
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
    renderOutfit(null, productImageUrl);
    return;
  }
  const outfit = outfitData[title];
  renderOutfit(outfit, productImageUrl);
};

const hydrateFromStorage = () => {
  if (!chrome.storage?.local) {
    console.warn('SNSE: chrome.storage.local unavailable in side panel.');
    return;
  }
  chrome.storage.local.get(['snseLastProductTitle', 'snseLastProductImageUrl', 'snsePickups'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to read stored data', chrome.runtime.lastError);
      return;
    }
    if (result?.snseLastProductTitle) {
      updateFromTitle(result.snseLastProductTitle, result.snseLastProductImageUrl);
    }
    renderPickups(result?.snsePickups || []);
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
    if (changes.snsePickups) {
      const nextPickups = changes.snsePickups.newValue || [];
      renderPickups(nextPickups);
      if (currentTitle) {
        updateClosetMatches(outfitData[currentTitle]);
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

hydrateFromStorage();
loadProfile();

