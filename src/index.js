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
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';

import { getStorage, ref, getDownloadURL, listAll, getMetadata } from "firebase/storage";
import { getApp } from 'firebase/app';

// DOM Elements
const image_container = document.getElementById('image-container');
const image = document.getElementById('image');
const timerElement = document.getElementById('timer');
const gameOverModal = document.getElementById('game-over-modal');
const homePage = document.getElementById('homepage');
const gamezone = document.getElementById('gamezone');
const gamezoneElements = document.querySelector('.gamezone-elements');
const backdrop = document.getElementById('backdrop');
const notifPositive = document.querySelector('.notification_positive');
const notifNegative = document.querySelector('.notification_negative');

document.getElementById('nav_new-game').addEventListener('click', () => returnToHome());


// Global variables
let charData = [];
let pinImgSrc;
let timer;
let currentImage = null;


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
  if (document.getElementById('target-box')) {
    const targetBox = document.getElementById('target-box');
    const dropdown = document.getElementById('dropdown-choices');
    image_container.removeChild(targetBox);
    image_container.removeChild(dropdown);
  }
  charData = [];
  clearInterval(timer);
  timerElement.textContent = '00:00';
  document.querySelectorAll('.pin-image').forEach(el => el.remove());
}

const endGame = () => {
  const targetBox = document.getElementById('target-box');
  const dropdown = document.getElementById('dropdown-choices');
  image_container.removeChild(targetBox);
  image_container.removeChild(dropdown);
  clearInterval(timer);
  backdrop.style.display = 'block';
  gameOverModal.style.display = 'flex';
  document.querySelector('.empty-username-message').style.display = 'none';
  const userNameInput = document.getElementById('username-input');
  userNameInput.value = '';
  const submitButton = document.getElementById('submit-score-button');
  submitButton.addEventListener('click', () => {
    if (userNameInput.value === '') {
      document.querySelector('.empty-username-message').style.display = 'block';
    } else {
      submitScore(currentImage, userNameInput.value, timerElement.textContent);
      gameOverModal.style.display = 'none';
      backdrop.style.display = 'none';
    }
  });
}

// Firebase functions
const storage = getStorage();

const getAllImages = async () => {
  const ID_array = [];
  const listRef = ref(storage, 'images');
  const imagesList = await listAll(listRef);
  for (const itemRef of imagesList.items) {
    const imageMetaData = await getMetadata(itemRef);
    const fileName = imageMetaData.name.substring(0, imageMetaData.name.indexOf('.jpg'));
    ID_array.push(fileName);
  }
  return ID_array;
}

const getData = async (imgID) => {
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
const loadHomePage = async () => {
  const data = await getAllImages();
  for (const img of data) {
    const imgData = await getData(img);
    createSlide(img, imgData);
    loadImgPreviews(img)
    initCarousel();
    const imageSelectionButtons = document.querySelectorAll('.image-selection_button');
    imageSelectionButtons.forEach(el => {
      el.addEventListener('click', (e) => {
        initGame(e.target.dataset.id);
      })
    })
  };
};

const submitScore = async (imgID, username, score) => {
  const leaderBoardRef = doc(db, 'imagesDB', imgID);
  await updateDoc(leaderBoardRef, {
    leaderboard: arrayUnion({username: username, score: score})
  });  
}

loadHomePage();

// Modals
document.getElementById('game-over-modal_close').addEventListener('click', () => {
  gameOverModal.style.display = 'none'
  backdrop.style.display = 'none';
});
document.getElementById('game-over-modal_new-game').addEventListener('click', () => returnToHome());


// Game flow
// Vérifie si le cadre contient le personnage
const checkCharacter = (x, y, coord, index) => {
  //console.log(x, y);
  if ((coord[0] -40) <= x && (coord[0] +40) >= x && (coord[1] -40) <= y && (coord[1] +40) >= y) {
    charData[index].found = true;
    document.getElementById(charData[index].char).style.display = 'none';
    addPinImage(pinImgSrc, coord[0], coord[1]);
    notifPositive.style.transition = 'all 0.5s';
    notifPositive.style.zIndex = '2';
    notifPositive.style.opacity = '100%';
    setTimeout(() => {
      notifPositive.style.zIndex = '-2';
      notifPositive.style.opacity = '0';
    }, 3000)
    updateDisplay();
    // Si tous les personnages ont été trouvés, arrête le timer
    if (allCharsFound()) {
      endGame()
    }
  } else {
    notifNegative.style.transition = 'all 0.5s';
    notifNegative.style.zIndex = '2';
    notifNegative.style.opacity = '100%';
    setTimeout(() => {
      notifNegative.style.zIndex = '-2';
      notifNegative.style.opacity = '0';
    }, 3000)
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
}

const returnToHome = () => {
  clearInterval(timer);
  gameOverModal.style.display = 'none';
  backdrop.style.display = 'none';
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
  if (document.getElementById('target-box') && !allCharsFound()) {
    const targetBox = document.getElementById('target-box');
    const dropdown = document.getElementById('dropdown-choices');
    image_container.removeChild(targetBox);
    image_container.removeChild(dropdown);
    displayTarget(tx, ty);
    displayDropdown(tx, ty, x, y, charData);
  } else if (!allCharsFound()) {
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
  
  nextSlide.addEventListener("click", () => {
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
  
  prevSlide.addEventListener("click", () => {
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


export { checkCharacter, allCharsFound };

// Add feedback to clicks (wrong guess // good guess)