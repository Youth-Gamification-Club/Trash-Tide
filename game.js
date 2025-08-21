window.onload = function () {
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

  const quizData = [
    {
      question: "What is the most common type of trash in the ocean?",
      answers: ["Plastic", "Glass", "Metal", "Wood"],
      correct: "Plastic"
    },
    {
      question: "How long does it take a plastic bottle to decompose?",
      answers: ["50 years", "450 years", "10 years", "1000 years"],
      correct: "450 years"
    },
    {
      question: "Which of these helps reduce ocean pollution?",
      answers: ["Recycling", "Littering", "Burning waste", "Using more plastic"],
      correct: "Recycling"
    },
    {
      question: "What is a microplastic?",
      answers: ["Large piece of trash", "Tiny plastic particles", "Ocean plant", "Plastic bag"],
      correct: "Tiny plastic particles"
    },
    {
      question: "Which ocean is the largest?",
      answers: ["Atlantic", "Indian", "Pacific", "Arctic"],
      correct: "Pacific"
    },
    {
      question: "Which sea creature is most affected by plastic rings?",
      answers: ["Turtles", "Sharks", "Dolphins", "Jellyfish"],
      correct: "Turtles"
    },
    {
      question: "How can you help reduce plastic use?",
      answers: ["Use reusable bags", "Buy bottled water", "Use plastic straws", "Burn plastic"],
      correct: "Use reusable bags"
    },
    {
      question: "What is the Great Pacific Garbage Patch?",
      answers: ["A volcano", "A recycling center", "A floating trash island", "A coral reef"],
      correct: "A floating trash island"
    },
    {
      question: "What is the best way to dispose of e-waste?",
      answers: ["Throw in ocean", "Recycle properly", "Burn it", "Bury it"],
      correct: "Recycle properly"
    },
    {
      question: "What marine animal uses echolocation?",
      answers: ["Octopus", "Dolphin", "Crab", "Shark"],
      correct: "Dolphin"
    },
    {
      question: "Which gas do ocean plants produce?",
      answers: ["Carbon dioxide", "Methane", "Oxygen", "Nitrogen"],
      correct: "Oxygen"
    },
    {
      question: "Which of these items takes the longest to decompose in the ocean?",
      answers: ["Paper", "Banana peel", "Aluminum can", "Fishing line"],
      correct: "Fishing line"
    },
    {
      question: "What does marine life often mistake plastic for?",
      answers: ["Food", "Rock", "Coral", "Other fish"],
      correct: "Food"
    },
    {
      question: "Which action helps ocean conservation?",
      answers: ["Overfishing", "Recycling", "Littering", "Polluting"],
      correct: "Recycling"
    },
    {
      question: "Why are coral reefs important?",
      answers: ["For surfing", "They are homes for marine life", "For plastic dumping", "To walk on"],
      correct: "They are homes for marine life"
    },
    {
      question: "What’s a biodegradable item?",
      answers: ["Glass", "Plastic", "Banana peel", "Aluminum foil"],
      correct: "Banana peel"
    },
    {
      question: "Which creature is a natural ocean cleaner?",
      answers: ["Shark", "Whale", "Crab", "Sea cucumber"],
      correct: "Sea cucumber"
    },
    {
      question: "How can oil spills harm ocean life?",
      answers: ["They feed fish", "They cool water", "They poison marine life", "They create waves"],
      correct: "They poison marine life"
    },
    {
      question: "Which of these is NOT recyclable?",
      answers: ["Plastic bottle", "Glass jar", "Pizza box (greasy)", "Metal can"],
      correct: "Pizza box (greasy)"
    },
    {
      question: "What is the primary cause of rising sea levels?",
      answers: ["Earthquakes", "Volcanoes", "Melting ice caps", "Plastic pollution"],
      correct: "Melting ice caps"
    },
    {
      question: "What’s the term for protecting the environment?",
      answers: ["Pollution", "Conservation", "Deforestation", "Erosion"],
      correct: "Conservation"
    },
    {
      question: "How much of the Earth’s surface is covered by oceans?",
      answers: ["30%", "50%", "70%", "90%"],
      correct: "70%"
    },
    {
      question: "Which type of bag is best for the environment?",
      answers: ["Plastic", "Paper", "Reusable cloth", "Styrofoam"],
      correct: "Reusable cloth"
    },
    {
      question: "How can we protect sea turtles?",
      answers: ["Leave lights on near beaches", "Clean beaches", "Feed them plastic", "Ride them"],
      correct: "Clean beaches"
    },
    {
      question: "What is overfishing?",
      answers: ["Fishing with friends", "Fishing too many fish", "Catching only big fish", "Using a fishing net"],
      correct: "Fishing too many fish"
    },
    {
      question: "Which of these can harm coral reefs?",
      answers: ["Sunscreen", "Swimming", "Fishing nearby", "Sunlight"],
      correct: "Sunscreen"
    },
    {
      question: "Why should we avoid single-use plastics?",
      answers: ["They’re colorful", "They are expensive", "They pollute and can’t decompose", "They taste bad"],
      correct: "They pollute and can’t decompose"
    },
    {
      question: "What is the main source of ocean plastic?",
      answers: ["Boats", "Factories", "People littering", "Volcanoes"],
      correct: "People littering"
    },
    {
      question: "What can you do to help marine animals?",
      answers: ["Use plastic straws", "Leave trash on the beach", "Recycle and reduce waste", "Feed them snacks"],
      correct: "Recycle and reduce waste"
    },
    {
      question: "What is ghost fishing?",
      answers: ["Fishing at night", "Fishing with spirits", "Lost nets that trap marine life", "Invisible bait"],
      correct: "Lost nets that trap marine life"
    },
    {
      question: "Which of these is a clean energy source?",
      answers: ["Oil", "Coal", "Solar", "Plastic"],
      correct: "Solar"
    }
  ];
  

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
          }, 2000);
        } else {
          showFeedbackPopup(`❌ Wrong! The correct answer is: ${random.correct}`, "rgba(255, 0, 0, 0.8)");
          fish.glow = true;
          setTimeout(() => {
            hideFeedbackPopup();
            fish.glow = false;
            gamePaused = false;
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
