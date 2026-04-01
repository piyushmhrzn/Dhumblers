// ================================================
// SOUND SYSTEM + GIF OVERLAY
// ================================================

function playSound(id) {
    const audio = document.getElementById(id);
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => { });
}

function showGif(type, playerName = "", customDuration = null) {
    const overlay = document.getElementById("gifOverlay");
    const text = document.getElementById("gifText");
    const elimGif = document.getElementById("elimGif");
    const funnyGif = document.getElementById("funnyGif");
    const highGif = document.getElementById("highGif");
    const nearElimGif = document.getElementById("nearElimGif");
    const winnerGif = document.getElementById("winnerGif");

    if (!overlay) return;

    // Reset all GIFs
    [elimGif, funnyGif, highGif, nearElimGif, winnerGif].forEach(gif => {
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
            duration = duration || 15000;
            break;
        case "funny":
            activeGif = funnyGif;
            duration = duration || 14000;
            break;
        case "high":
            activeGif = highGif;
            duration = duration || 10000;
            break;
        case "nearElim":
            activeGif = nearElimGif;
            duration = duration || 10000;
            break;
        case "winner":
            activeGif = winnerGif;
            duration = duration || 14000;
            break;
        default:
            duration = duration || 10000;
    }

    if (activeGif) {
        activeGif.style.display = "block";
        setTimeout(() => {
            activeGif.classList.add("gif-show");
        }, 50);
    }

    setTimeout(() => {
        overlay.classList.add("d-none");
    }, duration);
}