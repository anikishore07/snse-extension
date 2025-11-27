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

let currentTitle = null;

const setActiveTab = (tab) => {
  const isInspiration = tab === 'inspiration';
  inspirationView.classList.toggle('hidden', !isInspiration);
  pickupsView.classList.toggle('hidden', isInspiration);
  tabInspiration.classList.toggle('active', isInspiration);
  tabPickups.classList.toggle('active', !isInspiration);
};

tabInspiration?.addEventListener('click', () => setActiveTab('inspiration'));
tabPickups?.addEventListener('click', () => setActiveTab('pickups'));

const renderOutfit = (outfit) => {
  outfitResultEl.innerHTML = '';
  if (outfit) {
    const img = document.createElement('img');
    img.src = outfit.image;
    img.alt = 'Suggested outfit';
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';

    const caption = document.createElement('p');
    caption.textContent = 'Here is an outfit idea for this product.';

    outfitResultEl.appendChild(img);
    outfitResultEl.appendChild(caption);
  } else {
    const message = document.createElement('p');
    message.textContent = 'No outfit ideas yet for this item.';
    outfitResultEl.appendChild(message);
  }
};

const renderPickups = (items = []) => {
  pickupsListEl.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'No pickups saved yet.';
    pickupsListEl.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    const title = document.createElement('p');
    title.textContent = item.title;
    title.style.margin = '0 0 4px 0';
    title.style.fontWeight = '600';

    li.appendChild(title);

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      li.appendChild(img);
    }

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
    const newPickup = {
      title: currentTitle,
      image: outfit?.image || null,
      savedAt: Date.now()
    };
    chrome.storage.local.set(
      { snsePickups: [...existing, newPickup] },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('SNSE: Failed to save pickup', chrome.runtime.lastError);
          return;
        }
        renderPickups([...existing, newPickup]);
        console.log('SNSE: Pickup saved.');
      }
    );
  });
};

addPickupBtn?.addEventListener('click', savePickup);

const updateFromTitle = (title) => {
  currentTitle = title || null;
  if (!title) {
    renderOutfit(null);
    return;
  }
  const outfit = outfitData[title];
  renderOutfit(outfit);
};

const hydrateFromStorage = () => {
  if (!chrome.storage?.local) {
    console.warn('SNSE: chrome.storage.local unavailable in side panel.');
    return;
  }
  chrome.storage.local.get(['snseLastProductTitle', 'snsePickups'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('SNSE: Failed to read stored data', chrome.runtime.lastError);
      return;
    }
    if (result?.snseLastProductTitle) {
      updateFromTitle(result.snseLastProductTitle);
    }
    renderPickups(result?.snsePickups || []);
  });
};

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.snseLastProductTitle) {
      updateFromTitle(changes.snseLastProductTitle.newValue);
    }
    if (changes.snsePickups) {
      renderPickups(changes.snsePickups.newValue || []);
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'snse-product-title' && message.title) {
    updateFromTitle(message.title);
  }
});

hydrateFromStorage();

