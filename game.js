let quizData;
async function loadQuizData() {
  const response = await fetch("quizData.json");
  quizData = await response.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
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

  let bgImage, fishImage;

  // The gameLoop should only start AFTER bgImage and fishImage are loaded and assigned.
  // We use .then() to ensure this.
  Promise.all([loadImage("assets/ocean-bg.jpg"), loadImage("assets/fish.png")])
    .then(([bg, fish]) => {
      bgImage = bg;
      fishImage = fish;

      // Render
      gameLoop();
    })
    .catch((error) => {
      console.error("Failed to load images:", error);
      ctx.fillStyle = "red";
      ctx.font = "30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        "Error loading game assets!",
        canvas.width / 2,
        canvas.height / 2,
      );
    });

  let fish = {
    x: 100,
    y: canvas.height / 2,
    width: 150,
    height: 105,
    speed: 5,
  };

  let keys = {};
  let plastics = [];
  let plasticSpeed = 3;
  let spawnTimer = 0;
  let spawnInterval = 30;

  const trashItems = [
    { src: "assets/Black_trash_bag.png", w: 120, h: 140 },
    { src: "assets/Chipspack.png", w: 90, h: 110 },
    { src: "assets/Coke.png", w: 70, h: 100 },
    { src: "assets/Straw1.png", w: 20, h: 80 },
    { src: "assets/Straw2.png", w: 20, h: 80 },
  ];

  trashItems.forEach((item) => {
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
    if (
      feedbackActive &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      hideFeedbackPopup();
      gamePaused = false;
      requestAnimationFrame(gameLoop);
    }
  });
  window.addEventListener("keyup", (e) => (keys[e.key] = false));

  // Quiz Elements
  const quizPopup = document.getElementById("quizPopup");
  const quizQuestion = document.getElementById("quizQuestion");
  const quizAnswers = document.getElementById("quizAnswers");

  function triggerPowerUp() {
    // Filter out all "green" colored plastics (which were actually the normal trash, not pink)
    // Assuming the intent was to remove non-quiz-trigger plastics.
    plastics = plastics.filter((p) => p.isQuizTrigger); // Keeps only pink quiz triggers
    score += 3;

    const waveDuration = 500;
    const waveStartTime = Date.now();

    function drawPowerUpWave() {
      drawBackground(); // Draw the original background
      const elapsed = Date.now() - waveStartTime;
      if (elapsed < waveDuration) {
        const progress = elapsed / waveDuration;
        const alpha = 0.3 * Math.sin(progress * Math.PI); // Fades in and out
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawPowerUpWave);
      }
    }
    drawPowerUpWave();
  }

  const drawBackground = () => {
    // Ensure bgImage is loaded before drawing
    if (bgImage && bgImage.complete) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Fallback if image not loaded (should not happen with the Promise.all fix)
      ctx.fillStyle = "deepskyblue"; // Blank blue screen fallback
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  function showQuiz() {
    console.log("Showing quiz...");
    gamePaused = true;
    // Ensure quizData is loaded before trying to access it
    if (!quizData || quizData.length === 0) {
      console.error("Quiz data not loaded or empty.");
      showFeedbackPopup("Quiz data error!", "red");
      setTimeout(() => {
        hideFeedbackPopup();
        gamePaused = false;
        requestAnimationFrame(gameLoop);
      }, 2000);
      return;
    }

    const random = quizData[Math.floor(Math.random() * quizData.length)];
    quizQuestion.textContent = random.question;
    quizAnswers.innerHTML = "";

    random.answers.forEach((answer) => {
      const btn = document.createElement("button");
      btn.textContent = answer;
      btn.onclick = () => {
        quizAnswers
          .querySelectorAll("button")
          .forEach((b) => (b.disabled = true)); // Disable all buttons after one is clicked
        quizPopup.classList.add("hidden");

        if (answer === random.correct) {
          showFeedbackPopup("✅ Correct!", "rgba(0, 128, 0, 0.8)");
          if (powerUpReady) {
            setTimeout(() => {
              triggerPowerUp();
              powerUpReady = false;
            }, 1000); // Shorter delay to see the power-up effect
          }
          // Resume game sooner since quiz already hidden
          setTimeout(() => {
            hideFeedbackPopup();
            gamePaused = false;
            requestAnimationFrame(gameLoop);
          }, 1200);
        } else {
          showFeedbackPopup(
            `❌ Wrong! The correct answer is: ${random.correct}`,
            "rgba(255, 0, 0, 0.8)",
          );
          fish.glow = true;
          // Shorter feedback duration & quiz already hidden
          setTimeout(() => {
            hideFeedbackPopup();
            fish.glow = false;
            gamePaused = false;
            requestAnimationFrame(gameLoop);
          }, 2500);
        }
      };
      quizAnswers.appendChild(btn);
    });

    quizPopup.classList.remove("hidden");
  }

  function drawFish() {
    ctx.save();

    if (fish.glow) {
      ctx.shadowColor = "red";
      ctx.shadowBlur = 25;
    } else {
      ctx.shadowBlur = 0;
    }

    // Ensure fishImage is loaded before drawing
    if (fishImage && fishImage.complete) {
      ctx.drawImage(fishImage, fish.x, fish.y, fish.width, fish.height);
    } else {
      // Fallback if image not loaded (should not happen with the Promise.all fix)
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
    const isPink = Math.random() < 0.05; // 5% chance for a pink quiz trigger
    if (isPink) {
      plastics.push({
        x: canvas.width + 40,
        y: Math.random() * (canvas.height - 80),
        r: 40, // Radius for the pink circle
        color: "pink",
        passed: false,
        isQuizTrigger: true,
      });
    } else {
      const item = trashItems[Math.floor(Math.random() * trashItems.length)];
      plastics.push({
        x: canvas.width + item.w, // Start off-screen
        y: Math.random() * (canvas.height - item.h),
        w: item.w,
        h: item.h,
        img: item.img,
        passed: false,
        isQuizTrigger: false,
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

      // Check if plastic has passed the fish (for dodging score)
      // This should only increment score for non-quiz-trigger items
      if (!p.passed && !p.isQuizTrigger && p.x + (p.w || p.r) < fish.x) {
        p.passed = true;
        dodgedCount++;
        if (dodgedCount % 4 === 0) score++;
      }

      // Collision detection (simplified for combined objects and circles)
      // Using a basic AABB-like check for general items and circle-circle/circle-rect for pink
      const fishLeft = fish.x;
      const fishRight = fish.x + fish.width;
      const fishTop = fish.y;
      const fishBottom = fish.y + fish.height;

      let plasticLeft, plasticRight, plasticTop, plasticBottom;
      let collided = false;

      if (p.isQuizTrigger) {
        // Collision for pink circle with fish bounding box
        const circleX = p.x;
        const circleY = p.y;
        const circleRadius = p.r;

        // Find the closest point on the fish's bounding box to the center of the circle
        let testX = circleX;
        let testY = circleY;

        if (circleX < fishLeft) testX = fishLeft;
        else if (circleX > fishRight) testX = fishRight;
        if (circleY < fishTop) testY = fishTop;
        else if (circleY > fishBottom) testY = fishBottom;

        // Calculate the distance between the closest point and the circle's center
        const distX = circleX - testX;
        const distY = circleY - testY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance <= circleRadius) {
          collided = true;
        }
      } else {
        // AABB collision for image-based plastics
        plasticLeft = p.x;
        plasticRight = p.x + p.w;
        plasticTop = p.y;
        plasticBottom = p.y + p.h;

        if (
          fishRight > plasticLeft &&
          fishLeft < plasticRight &&
          fishBottom > plasticTop &&
          fishTop < plasticBottom
        ) {
          collided = true;
        }
      }

      if (collided) {
        if (p.isQuizTrigger) {
          plastics.splice(i, 1);
          powerUpReady = true;
          // Use setTimeout with 0ms to defer showQuiz() to the next event loop cycle,
          // which helps avoid issues if showQuiz() modifies the same array immediately.
          setTimeout(() => showQuiz(), 0);
          break; // Stop checking collisions for this frame after a quiz trigger hit
        } else {
          score--;
          plastics.splice(i, 1);
          continue; // Continue to the next plastic after collision
        }
      }

      // Remove plastic if it goes off-screen
      if (p.x + (p.r || p.w) < 0) {
        plastics.splice(i, 1);
        continue;
      }

      // ✅ Draw plastics
      if (p.isQuizTrigger) {
        ctx.beginPath();
        ctx.fillStyle = "pink";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (p.img && p.img.complete) {
          // Ensure item.img is loaded
          ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
        } else {
          ctx.fillStyle = "green"; // fallback box for trash if image not loaded
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
};
