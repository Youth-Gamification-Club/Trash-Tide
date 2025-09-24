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
  // Load persisted high score (if any) for display during gameplay
  let highScore = 0;
  try {
    highScore = Number(localStorage.getItem("trashTideHighScore") || 0);
    if (isNaN(highScore)) highScore = 0;
  } catch (e) {
    highScore = 0;
  }

  let gamePaused = false;
  let powerUpReady = false;
  let dodgedCount = 0;
  let feedbackPopup = document.getElementById("feedbackPopup");
  let feedbackActive = false;

  // Health system
  const MAX_HEALTH = 100;
  const QUIZ_HEALTH_REWARD = 15; // Health gained for a correct quiz answer
  let health = MAX_HEALTH;
  let gameOver = false;

  // Game Over elements (added dynamically if not present)
  let gameOverOverlay = document.getElementById("gameOverOverlay");
  let finalScoreEl = document.getElementById("finalScore");
  if (!gameOverOverlay) {
    // Safety fallback if HTML not updated
    gameOverOverlay = document.createElement("div");
    gameOverOverlay.id = "gameOverOverlay";
    gameOverOverlay.style.position = "fixed";
    gameOverOverlay.style.top = 0;
    gameOverOverlay.style.left = 0;
    gameOverOverlay.style.width = "100vw";
    gameOverOverlay.style.height = "100vh";
    gameOverOverlay.style.display = "flex";
    gameOverOverlay.style.alignItems = "center";
    gameOverOverlay.style.justifyContent = "center";
    gameOverOverlay.style.background = "rgba(0,0,0,0.75)";
    gameOverOverlay.style.color = "white";
    gameOverOverlay.style.fontFamily = "sans-serif";
    gameOverOverlay.style.zIndex = 2000;
    gameOverOverlay.classList.add("hidden");
    const inner = document.createElement("div");
    inner.style.textAlign = "center";
    inner.innerHTML =
      '<h1 style="margin-bottom:12px;font-size:48px;">Game Over</h1><p id="finalScore"></p>';
    gameOverOverlay.appendChild(inner);
    document.body.appendChild(gameOverOverlay);
    finalScoreEl = document.getElementById("finalScore");
  }

  let bgImage, fishImage;

  // The gameLoop should only start AFTER bgImage and fishImage are loaded and assigned.
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
    width: 75,
    height: 52.5,
    baseSpeed: 300, // base px/sec (old 5px/frame * 60)
  };

  let keys = {};
  let plastics = [];
  // --- Dynamic speed (time-based) configuration ---
  // Baseline speed in pixels per second when score = 0
  const BASE_PLASTIC_SPEED = 160; // tweakable
  // Additional pixels per second gained (or lost) per score point
  const SPEED_PER_SCORE = 6; // tweakable scaling factor
  // Minimum clamp so negative scores don't freeze gameplay
  const MIN_PLASTIC_SPEED = 60;
  // Spawning now uses spacing logic to keep on‑screen density roughly consistent.
  // We try to keep average horizontal distance between plastics near BASE_SPACING.
  const BASE_SPACING = 90; // px spacing at low score (tweakable)
  const MIN_SPACING = 55; // minimum spacing at high difficulty (tweakable)
  const SPACING_PER_SCORE = 0.6; // spacing reduction per score point until MIN_SPACING (tweakable)

  let spawnAccumulator = 0; // seconds accumulated
  // Delta time tracking
  let lastTimestamp = performance.now();

  function currentPlasticSpeed() {
    // Speed proportional to score (can go down if score decreases)
    return Math.max(
      MIN_PLASTIC_SPEED,
      BASE_PLASTIC_SPEED + score * SPEED_PER_SCORE,
    );
  }

  function currentSpawnInterval() {
    // Maintain relative density by converting desired spacing to time interval = spacing / speed
    const effectiveScore = Math.max(0, score); // don't expand spacing if score negative
    const desiredSpacing = Math.max(
      MIN_SPACING,
      BASE_SPACING - effectiveScore * SPACING_PER_SCORE,
    );
    return desiredSpacing / currentPlasticSpeed();
  }

  // --- Fish dynamic speed (time-based, proportional to score) ---
  const BASE_FISH_SPEED = 300; // px/sec at score 0
  const FISH_SPEED_PER_SCORE = 14; // px/sec added per score point
  const MIN_FISH_SPEED = 180; // clamp when score negative
  function currentFishSpeed() {
    return Math.max(
      MIN_FISH_SPEED,
      BASE_FISH_SPEED + score * FISH_SPEED_PER_SCORE,
    );
  }

  const trashItems = [
    { src: "assets/Black_trash_bag.png", w: 120, h: 140, damage: 20 },
    { src: "assets/Chipspack.png", w: 90, h: 110, damage: 12 },
    { src: "assets/Coke.png", w: 70, h: 100, damage: 15 },
    { src: "assets/Straw1.png", w: 20, h: 80, damage: 6 },
    { src: "assets/Straw2.png", w: 20, h: 80, damage: 6 },
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
          // Reward health ONLY (do not change score logic per requirement)
          health = Math.min(MAX_HEALTH, health + QUIZ_HEALTH_REWARD);
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

  function updateFish(dt) {
    const moveSpeed = currentFishSpeed();
    let dx = 0;
    let dy = 0;
    if (keys["ArrowUp"]) dy -= 1;
    if (keys["ArrowDown"]) dy += 1;
    if (keys["ArrowRight"]) dx += 1;
    if (keys["ArrowLeft"]) dx -= 1;
    if (dx !== 0 && dy !== 0) {
      // normalize diagonal
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }
    fish.x += dx * moveSpeed * dt;
    fish.y += dy * moveSpeed * dt;
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

  function updatePlastics(dt) {
    // dt in seconds
    spawnAccumulator += dt;
    const interval = currentSpawnInterval();
    let safety = 0; // prevent runaway spawns if interval becomes extremely small
    while (spawnAccumulator >= interval && safety < 5) {
      spawnPlastic();
      spawnAccumulator -= interval;
      safety++;
    }

    const plasticSpeed = currentPlasticSpeed();

    for (let i = plastics.length - 1; i >= 0; i--) {
      let p = plastics[i];
      // Move left based on time-scaled speed
      p.x -= plasticSpeed * dt;

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
          setTimeout(() => showQuiz(), 0);
          break;
        } else {
          // Apply health damage (do NOT modify existing score logic other than adjacent line)
          if (!gameOver) {
            const damage = p.damage || 10;
            health -= damage;
            if (health <= 0) {
              health = 0;
              triggerGameOver();
            }
          }
          score--; // existing score logic preserved
          plastics.splice(i, 1);
          continue;
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
    // Update high score (without changing how score itself is computed)
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem("trashTideHighScore", String(highScore));
      } catch (e) {
        // ignore storage failures
      }
    }

    ctx.save();
    ctx.fillStyle = "white";
    // Use Orbitron for canvas HUD
    ctx.font = "24px 'Orbitron', 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Score: " + score, 20, 40);

    // High Score on top-right
    ctx.textAlign = "right";
    ctx.fillText("High Score: " + highScore, canvas.width - 20, 40);
    ctx.restore();
  }

  function drawHealthBar() {
    const barX = 20;
    const barY = 60;
    const barW = 220;
    const barH = 22;
    const pct = health / MAX_HEALTH;

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(barX, barY, barW, barH);

    // Health fill (gradient)
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    grad.addColorStop(0, "#39d353");
    grad.addColorStop(1, pct < 0.3 ? "#ff4242" : "#2ea043");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * pct, barH);

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px 'Orbitron', 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`${Math.ceil(health)}/${MAX_HEALTH} HP`, barX + 8, barY + 16);
  }

  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    gamePaused = true;
    // Record high score locally
    try {
      const prev = Number(localStorage.getItem("trashTideHighScore") || 0);
      if (score > prev)
        localStorage.setItem("trashTideHighScore", String(score));
      const high = Number(localStorage.getItem("trashTideHighScore") || score);
      if (finalScoreEl) {
        finalScoreEl.textContent = `Final Score: ${score} | High Score: ${high}`;
      } else {
        console.log("Final Score:", score);
      }
      gameOverOverlay.classList.remove("hidden");
    } catch (e) {
      console.warn("High score storage failed", e);
      if (finalScoreEl) finalScoreEl.textContent = `Final Score: ${score}`;
      gameOverOverlay.classList.remove("hidden");
    }
  }

  function restartGame() {
    // Reset core state (score logic unchanged except resetting value)
    score = 0; // Allowed reset
    health = MAX_HEALTH;
    plastics = [];
    spawnAccumulator = 0;
    lastTimestamp = performance.now();
    powerUpReady = false;
    dodgedCount = 0;
    fish.x = 100;
    fish.y = canvas.height / 2;
    fish.glow = false;
    gameOver = false;
    gamePaused = false;
    hideFeedbackPopup();
    if (gameOverOverlay) gameOverOverlay.classList.add("hidden");
    requestAnimationFrame(gameLoop);
  }

  // Attach restart button handler if present
  const restartBtn = document.getElementById("restartBtn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => restartGame());
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

    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000; // seconds since last frame
    lastTimestamp = now;

    drawBackground();
    updateFish(dt);
    updatePlastics(dt);
    drawFish();
    drawScore();
    drawHealthBar();

    // Optional: debug overlay (uncomment to view real-time speed)
    // ctx.save();
    // ctx.fillStyle = 'rgba(0,0,0,0.4)';
    // ctx.font = '14px monospace';
    // ctx.fillText(`Speed: ${currentPlasticSpeed().toFixed(1)} px/s`, 20, 90);
    // ctx.restore();

    requestAnimationFrame(gameLoop);
  }
};
