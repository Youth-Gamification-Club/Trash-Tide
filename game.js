let quizData;
async function loadQuizData() {
  const response = await fetch("quizData.json");
  quizData = await response.json();
}

window.onload = async function () {
  await loadQuizData();

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let score = 0;
  let gamePaused = false;
  let powerUpReady = false;
  let dodgedCount = 0;
  let feedbackPopup = document.getElementById("feedbackPopup");
  let feedbackActive = false;

  const bgImage = new Image();
  bgImage.src = "assets/ocean-bg.jpg";

  const fishImage = new Image();
  fishImage.src = "assets/fish.png";

  let fish = {
    x: 100,
    y: canvas.height / 2,
    width: 150,
    height: 105,
    speed: 5
  };

  let keys = {};
  let plastics = [];
  let plasticSpeed = 3;
  let spawnTimer = 0;
  let spawnInterval = 30;

  // ✅ Load trash item images
  const trashItems = [
    { src: "assets/Black_trash_bag.png", w: 120, h: 140 },
    { src: "assets/Chipspack.png", w: 90, h: 110 },
    { src: "assets/Coke.png", w: 70, h: 100 },
    { src: "assets/Straw1.png", w: 20, h: 80 },
    { src: "assets/Straw2.png", w: 20, h: 80 }
  ];

  trashItems.forEach(item => {
    item.img = new Image();
    item.img.src = item.src;
  });


  // Touch controls
  let touchY = null;

  canvas.addEventListener("touchstart", (e) => {
    touchY = e.touches[0].clientY;
  });

  canvas.addEventListener("touchmove", (e) => {
    const newY = e.touches[0].clientY;
    fish.y += newY - touchY;
    touchY = newY;

    if (feedbackActive) {
      hideFeedbackPopup();
      gamePaused = false;
      requestAnimationFrame(gameLoop);
    }
  });


  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;

    // Hide feedback popup when player moves
    if (feedbackActive && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      hideFeedbackPopup();
      gamePaused = false;
      requestAnimationFrame(gameLoop);
    }
  });
  window.addEventListener("keyup", (e) => keys[e.key] = false);

  // Quiz Elements
  const quizPopup = document.getElementById("quizPopup");
  const quizQuestion = document.getElementById("quizQuestion");
  const quizAnswers = document.getElementById("quizAnswers");

  function triggerPowerUp() {
    plastics = plastics.filter(p => p.color !== "green");
    score += 3;

    const waveDuration = 500;
    const waveStartTime = Date.now();
    const originalDrawBackground = drawBackground;

    drawBackground = function () {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - waveStartTime;
      if (elapsed < waveDuration) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        drawBackground = originalDrawBackground;
      }
    };

    setTimeout(() => {
      drawBackground = originalDrawBackground;
    }, waveDuration);
  }

  function showQuiz() {
    console.log("Showing quiz...");
    gamePaused = true;
    const random = quizData[Math.floor(Math.random() * quizData.length)];
    quizQuestion.textContent = random.question;
    quizAnswers.innerHTML = "";

    random.answers.forEach(answer => {
      const btn = document.createElement("button");
      btn.textContent = answer;
      btn.onclick = () => {
        quizAnswers.querySelectorAll("button").forEach(b => b.disabled = true);
        quizPopup.classList.add("hidden");

        if (answer === random.correct) {
          showFeedbackPopup("✅ Correct!", "rgba(0, 128, 0, 0.8)");
          if (powerUpReady) {
            setTimeout(() => {
              triggerPowerUp();
              powerUpReady = false;
            }, 2000);
          }

          setTimeout(() => {
            hideFeedbackPopup();
            gamePaused = false;
            requestAnimationFrame(gameLoop);
          }, 2000);
        } else {
          showFeedbackPopup(`❌ Wrong! The correct answer is: ${random.correct}`, "rgba(255, 0, 0, 0.8)");
          fish.glow = true;
          setTimeout(() => {
            hideFeedbackPopup();
            fish.glow = false;
            gamePaused = false;
            requestAnimationFrame(gameLoop);
          }, 5000);
        }
      };
      quizAnswers.appendChild(btn);
    });

    quizPopup.classList.remove("hidden");
  }

  function drawBackground() {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  function drawFish() {
    ctx.save();
  
    if (fish.glow) {
      ctx.shadowColor = "red";
      ctx.shadowBlur = 25;
    } else {
      ctx.shadowBlur = 0;
    }
  
    if (fishImage.complete) {
      ctx.drawImage(fishImage, fish.x, fish.y, fish.width, fish.height);
    } else {
      ctx.fillStyle = "red";
      ctx.fillRect(fish.x, fish.y, fish.width, fish.height);
    }
  
    ctx.restore();
  }
  

  function updateFish() {
    if (keys["ArrowUp"]) fish.y -= fish.speed;
    if (keys["ArrowDown"]) fish.y += fish.speed;
    if (keys["ArrowRight"]) fish.x += fish.speed;
    if (keys["ArrowLeft"]) fish.x -= fish.speed;

    fish.y = Math.max(0, Math.min(canvas.height - fish.height, fish.y));
    fish.x = Math.max(50, Math.min(200, fish.x));
  }

  function spawnPlastic() {
    const isPink = Math.random() < 0.05;
    if (isPink) {
      plastics.push({
        x: canvas.width + 40,
        y: Math.random() * (canvas.height - 80),
        r: 40,
        color: "pink",
        passed: false,
        isQuizTrigger: true
      });
    } else {
      const item = trashItems[Math.floor(Math.random() * trashItems.length)];
      plastics.push({
        x: canvas.width + item.w,
        y: Math.random() * (canvas.height - item.h),
        w: item.w,
        h: item.h,
        img: item.img,
        passed: false,
        isQuizTrigger: false
      });
    }
  }


  function updatePlastics() {
    spawnTimer++;
    if (spawnTimer > spawnInterval) {
      spawnPlastic();
      spawnTimer = 0;
    }

    for (let i = plastics.length - 1; i >= 0; i--) {
      let p = plastics[i];
      p.x -= plasticSpeed;

      if (!p.passed && p.x + (p.r || p.w) < fish.x) {
        p.passed = true;
        dodgedCount++;
        if (dodgedCount % 4 === 0) score++;
      }

      // Collision detection
      const fishCenterX = fish.x + fish.width / 2;
      const fishCenterY = fish.y + fish.height / 2;
      const objCenterX = p.isQuizTrigger ? p.x : p.x + p.w / 2;
      const objCenterY = p.isQuizTrigger ? p.y : p.y + p.h / 2;
      const dx = fishCenterX - objCenterX;
      const dy = fishCenterY - objCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = p.isQuizTrigger ? p.r : Math.max(p.w, p.h) / 3;

      if (dist < radius + Math.max(fish.width, fish.height) / 3) {
        if (p.isQuizTrigger) {
          plastics.splice(i, 1);
          powerUpReady = true;
          requestAnimationFrame(() => showQuiz());
          break;
        } else {
          score--;
          plastics.splice(i, 1);
          continue;
        }
      }

      if (p.x + (p.r || p.w) < 0) {
        plastics.splice(i, 1);
        continue;
      }

      // ✅ Draw
      if (p.isQuizTrigger) {
        ctx.beginPath();
        ctx.fillStyle = "pink";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (p.img.complete) {
          ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
        } else {
          ctx.fillStyle = "green"; // fallback box
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
      }
    }
  }

  function drawScore() {
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    ctx.fillText("Score: " + score, 20, 40);
  }

  function showFeedbackPopup(message, color = "rgba(255, 0, 0, 0.8)") {
    feedbackPopup.textContent = message;
    feedbackPopup.style.background = color;
    feedbackPopup.classList.remove("hidden");
    feedbackActive = true;
  }

  function hideFeedbackPopup() {
    feedbackPopup.classList.add("hidden");
    feedbackActive = false;
  }

  function gameLoop() {
    if (gamePaused) return;

    drawBackground();
    updateFish();
    updatePlastics();
    drawFish();
    drawScore();
    requestAnimationFrame(gameLoop);
  }

  bgImage.onload = () => {
    fishImage.onload = () => {
      gameLoop();
    };
  };
};
