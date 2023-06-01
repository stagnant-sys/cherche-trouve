import './style.css';
import { displayTarget, displayDropdown, addPinImage, loadImgPreviews, createSlide } from './DOMElements';
import { db } from './firebase';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { getStorage, ref, getDownloadURL, listAll, getMetadata } from "firebase/storage";
import { getApp } from 'firebase/app';

// DOM Elements
const image_container = document.getElementById('image-container');
const image = document.getElementById('image');
const timerElement = document.getElementById('timer');
const gameOverModal = document.getElementById('game-over-modal');
const characterCounter = document.getElementById('character-counter');
const homePage = document.getElementById('homepage');
const gamezone = document.getElementById('gamezone');
const gamezoneElements = document.querySelector('.gamezone-elements');
document.getElementById('nav_new-game').addEventListener('click', () => {
  returnToHome();
})


// Global variables
let charData = [];
let charCounter;
let pinImgSrc;
let timer;
let currentImage = null;
const storageImagesList = [];


// Initialize game state, load characters data and images
const initGame = async (imgID) => {
  resetGameState();
  currentImage = imgID;
  // Get data from backend
  const imageData = await getData(imgID)
  charData = imageData.data;
  loadImage(imgID);
  loadPinImage();
  // Restart timer
  clearInterval(timer);
  const startingTime = new Date().getTime();
  timer = setInterval(() => { gameTimer(startingTime) }, 1000)
  
  updateDisplay();
}

const resetGameState = () => {
  charData = [];
  charCounter = 0;
  clearInterval(timer);
  document.querySelectorAll('.pin-image').forEach(el => el.remove());
}

const endGame = () => {
  clearInterval(timer);
  gameOverModal.style.display = 'block';
}

// Firebase functions
const storage = getStorage();

const getAllImages = () => {
  const listRef = ref(storage, 'images');
  listAll(listRef)
  .then((res) => {
    res.items.forEach((itemRef) => {
      getMetadata(itemRef)
      .then((medadata) => {
        const fileName = medadata.name.substring(0, medadata.name.indexOf('.jpg'))
        storageImagesList.push(fileName);
        return storageImagesList;
      })
    });
    
  }
  )
  .catch((error) => {
    switch (error.code) {
      case 'storage/object-not-found':
        break;
      case 'storage/unauthorized':
        break;
      case 'storage/canceled':
        break;
      case 'storage/unknown':
        break;
    }  
  });
}



async function getData (imgID) {
  const imageData = doc(db, 'imagesDB', imgID);
  const result = await getDoc(imageData);
  return result.data();
}

const loadImage = (img) => {
  const imageRef = ref(storage, `images/${img}.jpg`);
  getDownloadURL(imageRef)
  .then((url) => {
    image_container.style.display = 'block';
    image.src = url;
  })
  .catch((error) => {
    switch (error.code) {
      case 'storage/object-not-found':
        break;
      case 'storage/unauthorized':
        break;
      case 'storage/canceled':
        break;
      case 'storage/unknown':
        break;
    }
  });
}

const loadPinImage = () => {
  const pinImageRef = ref(storage, `pin.svg`);
  getDownloadURL(pinImageRef)
  .then((url) => {
    pinImgSrc = url;
  })  
}

// Load homepage
const loadHomePage = () => {
  getAllImages();
  setTimeout(() => {
    storageImagesList.forEach(async (img) => {
      const imgData = await getData(img);
      //console.log(imgData);
      createSlide(img, imgData);
      loadImgPreviews(img)
      initCarousel();
      const imageSelectionButtons = document.querySelectorAll('.image-selection_button');
      imageSelectionButtons.forEach(el => {
        el.addEventListener('click', (e) => {
          initGame(e.target.dataset.id);
        })
      })
      
    });
  }, 1000)
};

loadHomePage();

// Modals
document.getElementById('game-over-modal_close').addEventListener('click', () => gameOverModal.style.display = 'none');
document.getElementById('game-over-modal_start-again').addEventListener('click', () => {
  gameOverModal.style.display = 'none';
  initGame(currentImage);
});


// Game flow
// Vérifie si le cadre contient le personnage
const checkCharacter = (x, y, coord, index) => {
  console.log(x, y, coord);
  if ((coord[0] -40) <= x && (coord[0] +40) >= x && (coord[1] -40) <= y && (coord[1] +40) >= y) {
    charData[index].found = true;
    document.getElementById(charData[index].char).style.display = 'none';
    addPinImage(pinImgSrc, coord[0], coord[1]);
    charCounter++;
    updateDisplay();
    // Si tous les personnages ont été trouvés, arrête le timer
    if (allCharsFound()) {
      endGame()
    }
  } else {
    console.log('Nope');
  }
};

const allCharsFound = () => {
  const result = charData.every(el => {
    if (el.found === true) {
      return true;
    }
  });
  return result;
};

const updateDisplay = () => {
  homePage.style.transform = 'translateX(-100%)';
  gamezone.style.transform = 'translateX(0%)';
  gamezoneElements.style.display = 'block';
  characterCounter.textContent = `${charCounter} / ${charData.length}`;
}

const returnToHome = () => {
  gamezone.style.transform = 'translateX(100%)';
  homePage.style.transform = 'translateX(0%)';
  gamezoneElements.style.display = 'none';
}

image.addEventListener('click', (e) => {
  const bounds = image.getBoundingClientRect();
  const left = bounds.left;
  const top = bounds.top;
  const x = e.pageX - left - window.scrollX;
  const y = e.pageY - top - window.scrollY;
  const tx = x - 40;
  const ty = y - 40;
  /*const cw = image.clientWidth;
  const ch = image.clientHeight;
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const px = x/cw*iw;
  const py = y/ch*ih;*/
  if (document.getElementById('target-box')) {
    const targetBox = document.getElementById('target-box');
    const dropdown = document.getElementById('dropdown-choices');
    image_container.removeChild(targetBox);
    image_container.removeChild(dropdown);
    displayTarget(tx, ty);
    displayDropdown(tx, ty, x, y, charData);
  } else {
    displayTarget(tx, ty);
    displayDropdown(tx, ty, x, y, charData);
  }
})

// Timer function
const gameTimer = (startingTime) => {
  const timeDistance = new Date().getTime() - startingTime;
  const minutes = Math.floor((timeDistance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDistance % (1000 * 60)) / 1000);
  if (seconds < 10 && minutes < 10) {
    timerElement.textContent = `0${minutes}:0${seconds}`;
  } else if (seconds < 10) {
    timerElement.textContent = `${minutes}:0${seconds}`;
  } else if (minutes < 10) {
    timerElement.textContent = `0${minutes}:${seconds}`;
  } else {
    timerElement.textContent = `${minutes}:${seconds}`;
  }
};

// Image carousel
const initCarousel = () => {
  const slides = document.querySelectorAll(".slide");

  slides.forEach((slide, i) => {
    slide.style.transform = `translateX(${i * 100}%)`;
  });
  
  let curSlide = 0;
  let maxSlide = slides.length - 1;
  
  const nextSlide = document.querySelector(".btn-next");
  
  nextSlide.addEventListener("click", function () {
    if (curSlide === maxSlide) {
      curSlide = 0;
    } else {
      curSlide++;
    }
    slides.forEach((slide, i) => {
      slide.style.transform = `translateX(${100 * (i - curSlide)}%)`;
    });
  });
  
  const prevSlide = document.querySelector(".btn-prev");
  
  prevSlide.addEventListener("click", function () {
    if (curSlide === 0) {
      curSlide = maxSlide;
    } else {
      curSlide--;
    }
    slides.forEach((slide, indx) => {
      slide.style.transform = `translateX(${100 * (indx - curSlide)}%)`;
    });
  });  
}





// Test functions
const testButton = document.getElementById('test-button');
testButton.addEventListener('click', async () => {
  storageImagesList.forEach(img => {
    loadImgPreviews(img)
  });
})


export { checkCharacter, allCharsFound };

// Créer un container et la preview de chaque image présente dans le storage, avec informations (artiste, personnages à trouver)
// Récapitulatif des personnages à trouver, qui deviennent grisés lorsqu'on les trouve
// Ajouter leaderboard