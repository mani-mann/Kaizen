// DOM elements will be accessed when needed to avoid timing issues
let board, msg, eraDisplay, countryDisplay, regenerateBtn, newPhotoBtn, successNotification;

// Create floating era elements based on selected era
function createEraElements(era) {
  const eraElementsContainer = document.querySelector('.era-elements');
  if (!eraElementsContainer) return; // Exit if container doesn't exist
  
  eraElementsContainer.innerHTML = ''; // Clear existing elements
  
  const eraSymbols = {
    '1920s': ['🎷', '🍸', '🎭', '🚗', '📻', '💃'],
    '1940s': ['✈️', '📰', '🎖️', '🚂', '📻', '💌'],
    '1960s': ['☮️', '🌸', '🎸', '🚐', '🎵', '🦋'],
    '1980s': ['💿', '📼', '🕺', '🎮', '📻', '⚡'],
    '2000s': ['💽', '📱', '🎧', '💻', '🛴', '🎮'],
    'Present': ['📱', '💻', '🌍', '☁️', '🚀', '⚡']
  };
  
  const symbols = eraSymbols[era] || eraSymbols['Present'];
  
  for (let i = 0; i < 20; i++) {
    const element = document.createElement('div');
    element.className = 'era-element';
    element.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    element.style.left = Math.random() * 100 + '%';
    element.style.fontSize = (Math.random() * 20 + 20) + 'px';
    element.style.animationDelay = Math.random() * 15 + 's';
    element.style.animationDuration = (Math.random() * 10 + 15) + 's';
    eraElementsContainer.appendChild(element);
  }
}

// Enhanced polaroid creation with animations
function createTransformationPolaroid(caption) {
  // Try multiple selectors to find the container
  let container = document.querySelector('.transformation-container');
  if (!container) {
    container = document.querySelector('#board .transformation-container');
  }
  if (!container) {
    // If transformation-container doesn't exist, use the board directly
    container = document.querySelector('#board');
    if (container) {
      // Create the transformation-container div inside board
      const transformationDiv = document.createElement('div');
      transformationDiv.className = 'transformation-container';
      container.appendChild(transformationDiv);
      container = transformationDiv;
    }
  }
  if (!container) {
    console.error('Transformation container not found. Available elements:', document.querySelectorAll('div'));
    return null;
  }
  
  const polaroid = document.createElement('div');
  polaroid.className = 'pol';
  polaroid.innerHTML = `
    <div class="imgwrap">
      <div class="spin"></div>
    </div>
    <div class="dl" title="Download Your Transformation" style="display:none">
      <svg viewBox="0 0 24 24">
        <path d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h1zm-7 14h14v2H5v-2z"/>
      </svg>
    </div>
    <div class="cap">${caption || 'Your Historical Transformation'}</div>`;
  
  container.appendChild(polaroid);
  
  // Add entrance animation
  setTimeout(() => {
    polaroid.style.animation = 'zoomIn 1.2s ease-out forwards';
  }, 100);
  
  return polaroid;
}

// Set image with enhanced animations
function setImage(polaroid, src) {
  const imgWrap = polaroid.querySelector('.imgwrap');
  const downloadBtn = polaroid.querySelector('.dl');
  const img = document.createElement('img');
  
  img.src = src;
  img.alt = 'Your Historical Transformation';
  
  // Image load animation
  img.onload = () => {
    imgWrap.innerHTML = '';
    imgWrap.appendChild(img);
    
    // Fade in the image
    img.style.opacity = '0';
    img.style.transform = 'scale(0.8)';
    img.style.transition = 'all 0.8s ease';
    
    setTimeout(() => {
      img.style.opacity = '1';
      img.style.transform = 'scale(1)';
    }, 100);
    
    // Show download button
    downloadBtn.style.display = 'flex';
    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      downloadImage(src);
    };
    
    // Update message
    msg.innerHTML = `<strong>Transformation Complete!</strong> Your journey to ${selectedEra} ${selectedCountry} is ready!`;
  };
  
  img.onerror = () => {
    imgWrap.innerHTML = `
      <div style="padding:60px 30px; color:#b91c1c; font-size:16px; text-align:center; border-radius:16px; background:rgba(185,28,28,0.1);">
        <strong>Generation Failed</strong><br>
        <span style="font-size:14px; opacity:0.8;">Please try again with a different photo</span>
      </div>`;
    msg.innerHTML = 'Generation failed. <span class="back" onclick="location.href=\'/\'">← Try again</span>';
  };
  
  polaroid.dataset.src = src;
}

// Enhanced download function
async function downloadImage(src) {
  try {
    const filename = `past-forward-${(selectedEra||'era').replace(/[^a-z0-9-]+/gi,'-')}-${(selectedCountry||'world').replace(/[^a-z0-9-]+/gi,'-')}-${Date.now()}.jpg`;

    // Convert to Blob (works for both data URLs and http URLs)
    const response = await fetch(src);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSuccessNotification('Image downloaded successfully!');
  } catch (e) {
    console.error('Download failed', e);
    showSuccessNotification('Download failed. Try right-click → Save image as...');
  }
}

// Show success notification
function showSuccessNotification(message) {
  const notification = successNotification;
  notification.querySelector('span').textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// Enhanced loading messages
function updateLoadingMessage(era, country, step) {
  const messages = {
    preparing: `Preparing your journey to ${era} ${country}...`,
    generating: `Creating your ${era} transformation in ${country}...`,
    styling: `Applying authentic ${era} styling and ${country} atmosphere...`,
    finalizing: `Adding final historical details...`
  };
  
  msg.textContent = messages[step] || messages.preparing;
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  board = document.getElementById('board');
  msg = document.getElementById('msg');
  eraDisplay = document.getElementById('era-display');
  countryDisplay = document.getElementById('country-display');
  regenerateBtn = document.getElementById('regenerate-btn');
  newPhotoBtn = document.getElementById('new-photo-btn');
  successNotification = document.getElementById('success-notification');
  
  // Small delay to ensure all elements are rendered
  setTimeout(() => {
    // Get form data from sessionStorage
    const dataUrl = sessionStorage.getItem('pf_image');
    const selectedEra = sessionStorage.getItem('pf_eraYear') || '1920s';
    const selectedCountry = sessionStorage.getItem('pf_country') || 'United States';
    const selectedActivity = sessionStorage.getItem('pf_activity') || '';

// Update UI with selected options
if (eraDisplay) eraDisplay.textContent = selectedEra;
if (countryDisplay) countryDisplay.textContent = selectedCountry;
document.title = `Past Forward - Your ${selectedEra} Journey`;

// Create era-appropriate floating elements
createEraElements(selectedEra);

// Main generation logic
if (!dataUrl) {
  msg.innerHTML = 'No image found. <span class="back" onclick="location.href=\'/\'">← Go back</span>';
} else {
  // Create the polaroid container
  const resultPolaroid = createTransformationPolaroid(`Your ${selectedEra} Transformation`);
  if (!resultPolaroid) {
    msg.innerHTML = 'Error: Could not create transformation container. <span class="back" onclick="location.href=\'/\'">← Go back</span>';
    return;
  }
  
  // Start the generation process
  updateLoadingMessage(selectedEra, selectedCountry, 'preparing');
  
  fetch(dataUrl)
    .then(r => r.blob())
    .then(async (blob) => {
      updateLoadingMessage(selectedEra, selectedCountry, 'generating');
      
      // Create form data
      const formData = new FormData();
      formData.append('image', new File([blob], 'upload.png', { 
        type: blob.type || 'image/png' 
      }));
      formData.append('era', selectedEra);
      formData.append('country', selectedCountry);
      formData.append('activity', selectedActivity);
      
      try {
        updateLoadingMessage(selectedEra, selectedCountry, 'styling');
        
        // Call the API
        const response = await fetch('/api/style', { 
          method: 'POST', 
          body: formData 
        });
        
        updateLoadingMessage(selectedEra, selectedCountry, 'finalizing');
        
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          throw new Error(data?.error || `Server error: ${response.status}`);
        }
        
        // Set the generated image
        setImage(resultPolaroid, data.imageUrl);
        
      } catch (error) {
        console.error('Generation error:', error);
        
        // Show error in polaroid
        const imgWrap = resultPolaroid.querySelector('.imgwrap');
        imgWrap.innerHTML = `
          <div style="padding:60px 30px; color:#b91c1c; font-size:16px; text-align:center; border-radius:16px; background:rgba(185,28,28,0.1);">
            <strong>Generation Failed</strong><br>
            <span style="font-size:14px; opacity:0.8; margin-top:8px; display:block;">
              ${error.message || 'Please try again with a different photo'}
            </span>
          </div>`;
        
        msg.innerHTML = `
          Generation failed. 
          <span class="back" onclick="location.href='/'">← Try again</span> or 
          <span class="back" onclick="regenerateImage()">Try different settings</span>
        `;
      }
    })
    .catch(error => {
      console.error('Fetch error:', error);
      msg.innerHTML = `
        Error loading image. 
        <span class="back" onclick="location.href='/'">← Go back</span>
      `;
    });
}

// Button event handlers moved inside DOMContentLoaded

// Global function for regeneration
window.regenerateImage = function() {
  regenerateBtn.click();
};

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' && e.ctrlKey) {
    e.preventDefault();
    regenerateBtn.click();
  } else if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault();
    newPhotoBtn.click();
  } else if (e.key === 'd' && e.ctrlKey) {
    e.preventDefault();
    const src = document.querySelector('.pol')?.dataset?.src;
    if (src) {
      downloadImage(src);
    }
  }
});

// Add click handler to polaroid for download
document.addEventListener('click', (e) => {
  const polaroid = e.target.closest('.pol');
  if (polaroid && !e.target.closest('.dl')) {
    const src = polaroid.dataset.src;
    if (src) {
      downloadImage(src);
    }
  }
});

// Performance optimization: Preload next page
const link = document.createElement('link');
link.rel = 'prefetch';
link.href = '/';
document.head.appendChild(link);

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

console.log(`✨ Past Forward - ${selectedEra} transformation in ${selectedCountry} ready!`);
console.log('💡 Keyboard shortcuts: Ctrl+R (regenerate), Ctrl+N (new photo), Ctrl+D (download)');
  }, 100); // End of setTimeout
  
  // Button event handlers (moved inside DOMContentLoaded)
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', () => {
      // Add loading state
      regenerateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" style="animation: spin 1s linear infinite;">
          <path fill="currentColor" d="M4 12a8 8 0 0 1 14.93-4H17a1 1 0 1 0 0 2h4a1 1 0 0 0 1-1V5a1 1 0 1 0-2 0v1.07A10 10 0 1 0 14 22a1 1 0 1 0 0-2 8 8 0 0 1-10-8z"/>
        </svg>
        Generating...
      `;
      regenerateBtn.disabled = true;
      
      // Redirect to main page after animation
      setTimeout(() => {
        location.href = '/';
      }, 800);
    });
  }
  
  if (newPhotoBtn) {
    newPhotoBtn.addEventListener('click', () => {
      // Add loading state
      newPhotoBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" style="animation: spin 1s linear infinite;">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Loading...
      `;
      newPhotoBtn.disabled = true;
      
      // Redirect to main page after animation
      setTimeout(() => {
        location.href = '/';
      }, 800);
    });
  }
}); // End of DOMContentLoaded