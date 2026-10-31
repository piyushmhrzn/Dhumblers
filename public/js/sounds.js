// ================================================
// 🔊 SOUND SYSTEM + GIF DISPLAY
// ================================================
let gifHideTimeout = null;
let gifAnimationTimeout = null;

function playSound(id) {
    const audio = document.getElementById(id);
    if (!audio) return;

    // Stop every other game-effect sound before starting a new one.
    document.querySelectorAll("audio").forEach(otherAudio => {
        if (otherAudio !== audio) {
            otherAudio.pause();
            otherAudio.currentTime = 0;
        }
    });

    // Restart the selected sound from the beginning.
    audio.pause();
    audio.currentTime = 0;

    audio.play().catch(error => {
        console.warn("Audio playback unavailable:", id, error);
    });
}

/**
 * Shows GIF + plays sound for dramatic moments
 * Different durations based on event importance
 */
function showGif(type, playerName = "", customDuration = null) {

    const overlay = document.getElementById("gifOverlay");
    const text = document.getElementById("gifText");

    const elimGif = document.getElementById("elimGif");
    const funnyGif = document.getElementById("funnyGif");
    const highGif = document.getElementById("highGif");
    const midHighGif = document.getElementById("midHighGif");
    const nearElimGif = document.getElementById("nearElimGif");
    const criticalElimGif = document.getElementById("criticalElimGif");
    const winnerGif = document.getElementById("winnerGif");

    if (!overlay) return;

    // Cancel the previous GIF's auto-hide timer.
    if (gifHideTimeout !== null) {
        clearTimeout(gifHideTimeout);
        gifHideTimeout = null;
    }

    // Cancel any pending animation from the previous GIF.
    if (gifAnimationTimeout !== null) {
        clearTimeout(gifAnimationTimeout);
        gifAnimationTimeout = null;
    }

    // Reset all GIFs
    [
        elimGif,
        funnyGif,
        highGif,
        midHighGif,
        nearElimGif,
        criticalElimGif,
        winnerGif
    ].forEach(gif => {
        if (!gif) return;

        gif.style.display = "none";
        gif.classList.remove("gif-show");
    });

    text.innerText = playerName || "";

    overlay.classList.remove("d-none");

    let activeGif = null;
    let duration = customDuration;

    switch (type) {
        case "elim":
            activeGif = elimGif;
            duration = duration || 14000;
            break;
        case "funny":
            activeGif = funnyGif;
            duration = duration || 9000;
            break;
        case "high":
            activeGif = highGif;
            duration = duration || 8000;
            break;
        case "midHigh":
            activeGif = midHighGif;
            duration = duration || 6000;
            break;
        case "nearElim":
            activeGif = nearElimGif;
            duration = duration || 9000;
            break;
        case "criticalElim":
            activeGif = criticalElimGif;
            duration = duration || 8000;
            break;
        case "winner":
            activeGif = winnerGif;
            duration = duration || 6000;
            break;
        default:
            duration = duration || 10000;
    }

    if (activeGif) {
        activeGif.style.display = "block";

        gifAnimationTimeout = setTimeout(() => {
            activeGif.classList.add("gif-show");
            gifAnimationTimeout = null;
        }, 50);
    }

    // Auto-hide only after the current GIF's duration.
    gifHideTimeout = setTimeout(() => {
        overlay.classList.add("d-none");
        gifHideTimeout = null;
    }, duration);
}

// ────────────────────────────────────────────────
// 🔊 UNLOCK AUDIO (REQUIRED FOR INDEX PAGE)
// ────────────────────────────────────────────────

let audioUnlocked = false;

document.addEventListener("click", () => {
    if (audioUnlocked) return;

    audioUnlocked = true;

    const sounds = [
        "elimSound",
        "funnySound",
        "highScoreSound",
        "midHighSound",
        "nearElimSound",
        "criticalElimSound",
        "winnerSound"
    ];

    sounds.forEach(id => {
        const audio = document.getElementById(id);
        if (!audio) return;

        audio.load();
    });

    // Attempt to unlock audio playback using a silent sound
    // during the user's first interaction.
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
        const audioContext = new AudioContextClass();

        audioContext.resume()
            .then(() => {
                const buffer = audioContext.createBuffer(1, 1, 22050);
                const source = audioContext.createBufferSource();

                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start(0);

                console.log("🔊 Audio context activated!");
            })
            .catch(error => {
                console.warn("Audio activation unavailable:", error);
            });
    }

    console.log("🔊 Audio elements initialized!");
}, { once: true });