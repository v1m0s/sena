(() => {
  "use strict";

  const get = (id) => document.getElementById(id);

  const loginScreen = get("loginScreen");
  const gameScreen = get("gameScreen");
  const playerNameInput = get("playerName");
  const startButton = get("startButton");

  const canvas = get("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreValue = get("scoreValue");
  const bestValue = get("bestValue");
  const welcomeText = get("welcomeText");

  const pauseButton = get("pauseButton");
  const soundButton = get("soundButton");

  const pauseOverlay = get("pauseOverlay");
  const resumeButton = get("resumeButton");
  const homeFromPauseButton = get("homeFromPauseButton");

  const gameOverOverlay = get("gameOverOverlay");
  const restartButton = get("restartButton");
  const homeButton = get("homeButton");

  const finalScore = get("finalScore");
  const finalBest = get("finalBest");
  const resultMessage = get("resultMessage");
  const countdown = get("countdown");

  const leftButton = get("leftButton");
  const rightButton = get("rightButton");

  const state = {
    width: 0,
    height: 0,
    dpr: 1,

    running: false,
    paused: false,
    gameOver: false,
    muted: false,

    lastTime: 0,
    score: 0,
    best: Number(localStorage.getItem("senaBest") || 0),
    playerName: localStorage.getItem("senaPlayer") || "Oyuncu",

    lives: 3,
    combo: 0,
    level: 1,

    spawnTimer: 0,

    objects: [],
    particles: [],
    backgroundDots: [],

    player: {
      x: 0,
      y: 0,
      radius: 25,
      speed: 360,
      invincible: 0
    },

    input: {
      left: false,
      right: false,
      targetX: null
    },

    audio: null
  };

  bestValue.textContent = state.best;

  if (state.playerName !== "Oyuncu") {
    playerNameInput.value = state.playerName;
  }

  function cleanName(value) {
    const clean = value.replace(/[<>]/g, "").trim().slice(0, 15);
    return clean || "Oyuncu";
  }

  function initAudio() {
    if (state.audio) return;

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    try {
      state.audio = new AudioContext();
    } catch (error) {
      state.audio = null;
    }
  }

  function playSound(frequency, duration, volume = 0.04, type = "sine") {
    if (state.muted || !state.audio) return;

    if (state.audio.state === "suspended") {
      state.audio.resume().catch(() => {});
    }

    const now = state.audio.currentTime;
    const oscillator = state.audio.createOscillator();
    const gain = state.audio.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    oscillator.connect(gain);
    gain.connect(state.audio.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);

    ctx.setTransform(
      state.dpr,
      0,
      0,
      state.dpr,
      0,
      0
    );

    state.player.y = state.height - 70;

    if (!state.player.x) {
      state.player.x = state.width / 2;
    }

    state.player.x = Math.max(
      state.player.radius + 8,
      Math.min(
        state.width - state.player.radius - 8,
        state.player.x
      )
    );

    createBackgroundDots();
  }

  function createBackgroundDots() {
    const count = Math.max(
      25,
      Math.round((state.width * state.height) / 11000)
    );

    state.backgroundDots = Array.from(
      { length: count },
      () => ({
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        radius: 0.8 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.7
      })
    );
  }

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.combo = 0;
    state.level = 1;
    state.spawnTimer = 0;
    state.objects = [];
    state.particles = [];

    state.player.x = state.width / 2;
    state.player.y = state.height - 70;
    state.player.invincible = 0;

    state.input.left = false;
    state.input.right = false;
    state.input.targetX = null;

    state.gameOver = false;
    state.paused = false;

    scoreValue.textContent = "0";

    gameOverOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
  }

  async function startCountdown() {
    state.running = false;

    countdown.classList.remove("hidden");

    const values = ["3", "2", "1", "SENA!"];

    for (const value of values) {
      countdown.textContent = value;

      if (value === "SENA!") {
        playSound(650, 0.12, 0.045, "triangle");
      } else {
        playSound(
          350 + Number(value) * 70,
          0.1,
          0.035,
          "triangle"
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, value === "SENA!" ? 450 : 520)
      );
    }

    countdown.classList.add("hidden");

    state.running = true;
    state.paused = false;
    state.lastTime = performance.now();

    requestAnimationFrame(gameLoop);
  }

  function startGame() {
    initAudio();

    state.playerName = cleanName(playerNameInput.value);

    localStorage.setItem(
      "senaPlayer",
      state.playerName
    );

    welcomeText.textContent =
      state.playerName + " • Neon Ağ";

    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    requestAnimationFrame(() => {
      resizeCanvas();
      resetGame();
      startCountdown();
    });
  }

  function goHome() {
    state.running = false;
    state.paused = false;
    state.gameOver = false;

    pauseOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");

    gameScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }

  function spawnObject() {
    const difficulty = Math.min(
      2.3,
      1 + state.score / 650
    );

    const dangerChance = Math.min(
      0.44,
      0.18 + state.level * 0.025
    );

    const isDanger = Math.random() < dangerChance;
    const isRare =
      !isDanger && Math.random() < 0.12;

    const radius = isDanger
      ? 16 + Math.random() * 8
      : isRare
      ? 13
      : 10 + Math.random() * 4;

    state.objects.push({
      type: isDanger
        ? "danger"
        : isRare
        ? "rare"
        : "energy",

      x: 25 + Math.random() * (state.width - 50),
      y: -40,

      radius,

      velocityY:
        (145 + Math.random() * 75) * difficulty,

      velocityX:
        (Math.random() - 0.5) *
        (isDanger ? 60 : 24),

      rotation: Math.random() * Math.PI * 2,
      rotationSpeed:
        (Math.random() - 0.5) * 2.5,

      pulse: Math.random() * Math.PI * 2
    });
  }

  function createParticles(
    x,
    y,
    type,
    count = 12
  ) {
    const color =
      type === "danger"
        ? "#ff557d"
        : type === "rare"
        ? "#ff72d2"
        : "#55ddff";

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 130;

      state.particles.push({
        x,
        y,

        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,

        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,

        size: 1.5 + Math.random() * 3.5,
        color
      });
    }
  }

  function collision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    const radius =
      a.radius + b.radius;

    return dx * dx + dy * dy <= radius * radius;
  }

  function collectObject(object) {
    const baseScore =
      object.type === "rare" ? 35 : 10;

    state.combo += 1;

    const comboBonus =
      Math.min(
        20,
        Math.floor(state.combo / 5) * 2
      );

    state.score += baseScore + comboBonus;

    state.level =
      1 + Math.floor(state.score / 180);

    scoreValue.textContent =
      state.score;

    createParticles(
      object.x,
      object.y,
      object.type,
      object.type === "rare" ? 20 : 12
    );

    playSound(
      object.type === "rare"
        ? 790
        : 500 + Math.min(230, state.combo * 7),
      0.09,
      0.045,
      "triangle"
    );
  }

  function damagePlayer(object) {
    if (state.player.invincible > 0) return;

    state.lives -= 1;
    state.combo = 0;

    state.player.invincible = 1.1;

    createParticles(
      object.x,
      object.y,
      "danger",
      25
    );

    playSound(
      125,
      0.25,
      0.07,
      "sawtooth"
    );

    if (state.lives <= 0) {
      finishGame();
    }
  }

  function finishGame() {
    state.running = false;
    state.gameOver = true;

    if (state.score > state.best) {
      state.best = state.score;

      localStorage.setItem(
        "senaBest",
        String(state.best)
      );

      resultMessage.textContent =
        "Yeni rekor! SENA ağında iz bıraktın.";
    } else if (
      state.score >= Math.max(80, state.best * 0.8)
    ) {
      resultMessage.textContent =
        "Rekora çok yaklaştın. Bir tur daha dene.";
    } else {
      resultMessage.textContent =
        "Ağ hızlandı. Enerjileri toplayıp tekrar dene.";
    }

    bestValue.textContent = state.best;
    finalScore.textContent = state.score;
    finalBest.textContent = state.best;

    gameOverOverlay.classList.remove("hidden");
  }

  function update(deltaTime) {
    const player = state.player;

    player.invincible = Math.max(
      0,
      player.invincible - deltaTime
    );

    let direction = 0;

    if (state.input.left) direction -= 1;
    if (state.input.right) direction += 1;

    if (state.input.targetX !== null) {
      const difference =
        state.input.targetX - player.x;

      if (Math.abs(difference) > 2) {
        direction = Math.sign(difference);

        const movementSpeed = Math.min(
          player.speed * 1.4,
          Math.abs(difference) /
            Math.max(deltaTime, 0.001)
        );

        player.x +=
          direction *
          movementSpeed *
          deltaTime;
      }
    } else {
      player.x +=
        direction *
        player.speed *
        deltaTime;
    }

    player.x = Math.max(
      player.radius + 8,
      Math.min(
        state.width - player.radius - 8,
        player.x
      )
    );

    state.spawnTimer -= deltaTime;

    if (state.spawnTimer <= 0) {
      spawnObject();

      const interval = Math.max(
        0.29,
        0.72 - state.level * 0.026
      );

      state.spawnTimer =
        interval *
        (0.78 + Math.random() * 0.44);
    }

    for (
      let i = state.objects.length - 1;
      i >= 0;
      i--
    ) {
      const object = state.objects[i];

      object.y +=
        object.velocityY * deltaTime;

      object.x +=
        object.velocityX * deltaTime;

      object.rotation +=
        object.rotationSpeed * deltaTime;

      object.pulse += deltaTime * 4;

      if (
        object.x < object.radius ||
        object.x > state.width - object.radius
      ) {
        object.velocityX *= -1;
      }

      if (collision(player, object)) {
        state.objects.splice(i, 1);

        if (object.type === "danger") {
          damagePlayer(object);
        } else {
          collectObject(object);
        }

        continue;
      }

      if (
        object.y - object.radius >
        state.height + 15
      ) {
        state.objects.splice(i, 1);

        if (object.type !== "danger") {
          state.combo = Math.max(
            0,
            state.combo - 1
          );
        }
      }
    }

    for (
      let i = state.particles.length - 1;
      i >= 0;
      i--
    ) {
      const particle = state.particles[i];

      particle.life -= deltaTime;

      if (particle.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }

      particle.x +=
        particle.velocityX * deltaTime;

      particle.y +=
        particle.velocityY * deltaTime;

      particle.velocityX *= Math.pow(
        0.1,
        deltaTime
      );

      particle.velocityY *= Math.pow(
        0.15,
        deltaTime
      );
    }
  }

  function drawBackground(time) {
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        state.height
      );

    gradient.addColorStop(0, "#0c1034");
    gradient.addColorStop(0.48, "#090b25");
    gradient.addColorStop(1, "#050614");

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      state.width,
      state.height
    );

    const glow =
      ctx.createRadialGradient(
        state.width * 0.5,
        state.height * 0.22,
        0,
        state.width * 0.5,
        state.height * 0.22,
        state.width * 0.8
      );

    glow.addColorStop(
      0,
      "rgba(100, 95, 255, 0.22)"
    );

    glow.addColorStop(
      0.5,
      "rgba(255, 80, 190, 0.07)"
    );

    glow.addColorStop(
      1,
      "rgba(0, 0, 0, 0)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
      0,
      0,
      state.width,
      state.height
    );

    const horizon = state.height * 0.43;

    ctx.save();

    ctx.strokeStyle =
      "rgba(85, 221, 255, 0.08)";

    ctx.lineWidth = 1;

    const spacing = Math.max(
      35,
      state.width / 9
    );

    for (
      let x = -state.width;
      x <= state.width * 2;
      x += spacing
    ) {
      ctx.beginPath();

      ctx.moveTo(
        state.width / 2,
        horizon
      );

      ctx.lineTo(
        x,
        state.height
      );

      ctx.stroke();
    }

    for (let i = 0; i < 10; i++) {
      const progress = i / 9;

      const y =
        horizon +
        progress *
          progress *
          (state.height - horizon);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
      ctx.stroke();
    }

    ctx.restore();

    for (
      let i = 0;
      i < state.backgroundDots.length;
      i++
    ) {
      const dot = state.backgroundDots[i];

      const alpha =
        0.2 +
        Math.sin(
          time * 0.001 * dot.speed +
            dot.phase
        ) *
          0.12;

      ctx.fillStyle =
        i % 6 === 0
          ? `rgba(255, 95, 201, ${alpha + 0.12})`
          : `rgba(85, 221, 255, ${alpha})`;

      ctx.beginPath();

      ctx.arc(
        dot.x,
        dot.y,
        dot.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }

  function drawEnergy(object) {
    const pulse =
      1 + Math.sin(object.pulse) * 0.1;

    ctx.save();

    ctx.translate(
      object.x,
      object.y
    );

    ctx.scale(pulse, pulse);

    const color =
      object.type === "rare"
        ? "#ff72d2"
        : "#55ddff";

    ctx.shadowBlur =
      object.type === "rare" ? 27 : 19;

    ctx.shadowColor = color;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      object.radius,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.fillStyle =
      object.type === "rare"
        ? "rgba(255, 114, 210, 0.32)"
        : "rgba(85, 221, 255, 0.28)";

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      object.radius * 0.62,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.rotate(object.rotation);

    ctx.fillStyle = "#ffffff";

    const spikes =
      object.type === "rare" ? 6 : 4;

    ctx.beginPath();

    for (let i = 0; i < spikes * 2; i++) {
      const angle =
        (Math.PI * i) / spikes -
        Math.PI / 2;

      const radius =
        i % 2 === 0
          ? object.radius * 0.6
          : object.radius * 0.17;

      const x =
        Math.cos(angle) * radius;

      const y =
        Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawDanger(object) {
    ctx.save();

    ctx.translate(
      object.x,
      object.y
    );

    ctx.rotate(object.rotation);

    ctx.shadowBlur = 21;
    ctx.shadowColor = "#ff557d";

    ctx.fillStyle =
      "rgba(255, 85, 125, 0.3)";

    ctx.strokeStyle = "#ff668d";
    ctx.lineWidth = 2.5;

    ctx.beginPath();

    for (let i = 0; i < 8; i++) {
      const angle =
        (Math.PI * 2 * i) / 8;

      const radius =
        i % 2 === 0
          ? object.radius
          : object.radius * 0.65;

      const x =
        Math.cos(angle) * radius;

      const y =
        Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.moveTo(
      -object.radius * 0.35,
      -object.radius * 0.35
    );

    ctx.lineTo(
      object.radius * 0.35,
      object.radius * 0.35
    );

    ctx.moveTo(
      object.radius * 0.35,
      -object.radius * 0.35
    );

    ctx.lineTo(
      -object.radius * 0.35,
      object.radius * 0.35
    );

    ctx.stroke();

    ctx.restore();
  }

  function drawPlayer() {
    const player = state.player;

    const flicker =
      player.invincible > 0 &&
      Math.floor(player.invincible * 12) % 2 === 0;

    if (flicker) return;

    ctx.save();

    ctx.translate(
      player.x,
      player.y
    );

    const trail =
      ctx.createRadialGradient(
        0,
        15,
        4,
        0,
        15,
        48
      );

    trail.addColorStop(
      0,
      "rgba(85, 221, 255, 0.45)"
    );

    trail.addColorStop(
      1,
      "rgba(85, 221, 255, 0)"
    );

    ctx.fillStyle = trail;

    ctx.beginPath();

    ctx.ellipse(
      0,
      17,
      48,
      28,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowBlur = 23;
    ctx.shadowColor = "#55ddff";

    ctx.fillStyle = "#111638";

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      player.radius + 5,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      state.combo >= 10
        ? "#ff72d2"
        : "#55ddff";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      player.radius + 4,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    const faceGradient =
      ctx.createLinearGradient(
        -player.radius,
        -player.radius,
        player.radius,
        player.radius
      );

    faceGradient.addColorStop(
      0,
      "#9b5dff"
    );

    faceGradient.addColorStop(
      1,
      "#ff5fc9"
    );

    ctx.fillStyle = faceGradient;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      player.radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 25px Arial";

    ctx.fillText("S", 0, 1);

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(
        0,
        particle.life / particle.maxLife
      );

      ctx.fillStyle = particle.color;

      ctx.beginPath();

      ctx.arc(
        particle.x,
        particle.y,
        particle.size,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawGameInfo() {
    ctx.save();

    ctx.font = "700 13px Arial";
    ctx.textBaseline = "middle";

    ctx.fillStyle =
      "rgba(8, 10, 31, 0.75)";

    ctx.strokeStyle =
      "rgba(255, 255, 255, 0.1)";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(
      12,
      12,
      105,
      34,
      14
    );
    ctx.fill();
    ctx.stroke();

    const livesText =
      "◆".repeat(Math.max(0, state.lives)) +
      "◇".repeat(Math.max(0, 3 - state.lives));

    ctx.fillStyle = "#ff72d2";
    ctx.fillText(livesText, 24, 29);

    const infoText =
      state.combo >= 2
        ? "KOMBO x" + state.combo
        : "SEVİYE " + state.level;

    const width = Math.max(
      105,
      ctx.measureText(infoText).width + 28
    );

    ctx.beginPath();

    ctx.roundRect(
      state.width - width - 12,
      12,
      width,
      34,
      14
    );

    ctx.fillStyle =
      "rgba(8, 10, 31, 0.75)";

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle =
      state.combo >= 5
        ? "#ff72d2"
        : "#55ddff";

    ctx.textAlign = "center";

    ctx.fillText(
      infoText,
      state.width - width / 2 - 12,
      29
    );

    ctx.restore();
  }

  function draw(time) {
    drawBackground(time);

    for (const object of state.objects) {
      if (object.type === "danger") {
        drawDanger(object);
      } else {
        drawEnergy(object);
      }
    }

    drawParticles();
    drawPlayer();
    drawGameInfo();
  }

  function gameLoop(time) {
    if (
      !state.running ||
      state.paused ||
      state.gameOver
    ) {
      return;
    }

    const deltaTime = Math.min(
      0.035,
      Math.max(
        0,
        (time - state.lastTime) / 1000
      )
    );

    state.lastTime = time;

    update(deltaTime);
    draw(time);

    if (state.running) {
      requestAnimationFrame(gameLoop);
    }
  }

  function setPause(paused) {
    if (
      state.gameOver ||
      gameScreen.classList.contains("hidden")
    ) {
      return;
    }

    state.paused = paused;
    state.running = !paused;

    pauseOverlay.classList.toggle(
      "hidden",
      !paused
    );

    pauseButton.textContent =
      paused ? "▶" : "Ⅱ";

    pauseButton.setAttribute(
      "aria-label",
      paused
        ? "Oyuna devam et"
        : "Oyunu duraklat"
    );

    if (!paused) {
      state.lastTime = performance.now();
      requestAnimationFrame(gameLoop);
    }
  }

  function moveWithPointer(event) {
    if (!state.running) return;

    const rect =
      canvas.getBoundingClientRect();

    state.input.targetX = Math.max(
      0,
      Math.min(
        rect.width,
        event.clientX - rect.left
      )
    );
  }

  function clearPointerTarget() {
    state.input.targetX = null;
  }

  function bindMoveButton(
    button,
    direction
  ) {
    const start = (event) => {
      event.preventDefault();

      state.input[direction] = true;
      state.input.targetX = null;

      try {
        button.setPointerCapture(
          event.pointerId
        );
      } catch (error) {}
    };

    const stop = (event) => {
      event.preventDefault();
      state.input[direction] = false;
    };

    button.addEventListener(
      "pointerdown",
      start
    );

    button.addEventListener(
      "pointerup",
      stop
    );

    button.addEventListener(
      "pointercancel",
      stop
    );

    button.addEventListener(
      "lostpointercapture",
      stop
    );
  }

  startButton.addEventListener(
    "click",
    startGame
  );

  playerNameInput.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        startGame();
      }
    }
  );

  pauseButton.addEventListener(
    "click",
    () => {
      setPause(!state.paused);
    }
  );

  resumeButton.addEventListener(
    "click",
    () => {
      setPause(false);
    }
  );

  homeFromPauseButton.addEventListener(
    "click",
    goHome
  );

  restartButton.addEventListener(
    "click",
    () => {
      resetGame();
      startCountdown();
    }
  );

  homeButton.addEventListener(
    "click",
    goHome
  );

  soundButton.addEventListener(
    "click",
    () => {
      initAudio();

      state.muted = !state.muted;

      soundButton.textContent =
        state.muted ? "×" : "♪";

      soundButton.setAttribute(
        "aria-label",
        state.muted
          ? "Sesi aç"
          : "Sesi kapat"
      );

      if (!state.muted) {
        playSound(
          560,
          0.08,
          0.035,
          "triangle"
        );
      }
    }
  );

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();

      moveWithPointer(event);

      try {
        canvas.setPointerCapture(
          event.pointerId
        );
      } catch (error) {}
    }
  );

  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (
        event.buttons ||
        event.pressure > 0
      ) {
        moveWithPointer(event);
      }
    }
  );

  canvas.addEventListener(
    "pointerup",
    clearPointerTarget
  );

  canvas.addEventListener(
    "pointercancel",
    clearPointerTarget
  );

  bindMoveButton(
    leftButton,
    "left"
  );

  bindMoveButton(
    rightButton,
    "right"
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "ArrowLeft" ||
        event.key === "a" ||
        event.key === "A"
      ) {
        event.preventDefault();

        state.input.left = true;
        state.input.targetX = null;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "d" ||
        event.key === "D"
      ) {
        event.preventDefault();

        state.input.right = true;
        state.input.targetX = null;
      }

      if (
        event.key === " " &&
        !gameScreen.classList.contains("hidden")
      ) {
        event.preventDefault();
        setPause(!state.paused);
      }
    }
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (
        event.key === "ArrowLeft" ||
        event.key === "a" ||
        event.key === "A"
      ) {
        state.input.left = false;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "d" ||
        event.key === "D"
      ) {
        state.input.right = false;
      }
    }
  );

  window.addEventListener(
    "resize",
    resizeCanvas
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        state.running
      ) {
        setPause(true);
      }
    }
  );

  draw(0);
})();
