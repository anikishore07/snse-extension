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

const renderOutfit = (outfit) => {
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
    const message = document.createElement('p');
    message.textContent = 'No outfit ideas yet for this item.';
    outfitResultEl.appendChild(message);
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
    updateFromTitle(message.title);
  }
});

hydrateFromStorage();

