// ============================================================
// 🔊 DHUMBLE SCORE ANNOUNCER
// ============================================================
//
// Manual announcement only.
//
// Announces:
//
// • Current round
// • Latest-round Dhumble
// • Active scores LOWEST → HIGHEST
// • Latest elimination
//
// Uses browser Web Speech API.
//
// ============================================================


// ------------------------------------------------------------
// ANNOUNCER SETTINGS
// ------------------------------------------------------------

// Faster, more natural conversational speed.
const ANNOUNCER_RATE = 1.08;

const ANNOUNCER_PITCH = 1;
const ANNOUNCER_VOLUME = 1;


// ============================================================
// MAIN ANNOUNCE FUNCTION
// ============================================================

async function announceLiveScores() {

    if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
    ) {

        alert(
            "Voice announcements are not supported by this browser."
        );

        return;
    }


    let game = null;


    try {

        game = await fetchOngoingGame();

    }
    catch (error) {

        console.error(
            "Announcer could not fetch ongoing game:",
            error
        );
    }


    if (!game) {

        speakAnnouncement(
            "Ay Pakhe. Game tah suru huna dey."
        );

        return;
    }


    if (
        !Array.isArray(game.rounds) ||
        game.rounds.length === 0
    ) {

        speakAnnouncement(
            "The game has started. No rounds have been played yet."
        );

        return;
    }


    const announcement =
        buildLiveScoreAnnouncement(game);


    if (!announcement) {

        speakAnnouncement(
            "Score information is not available."
        );

        return;
    }


    console.log(
        "🔊 Announcement:",
        announcement
    );


    speakAnnouncement(
        announcement
    );
}



// ============================================================
// BUILD ANNOUNCEMENT
// ============================================================

function buildLiveScoreAnnouncement(game) {

    const roundNumber =
        Array.isArray(game.rounds)
            ? game.rounds.length
            : 0;


    const parts = [];


    // --------------------------------------------------------
    // ROUND
    // --------------------------------------------------------

    parts.push(
        `Round ${roundNumber}.`
    );


    // --------------------------------------------------------
    // DHUMBLE
    // --------------------------------------------------------

    const latestDhumble =
        getAnnouncerLatestDhumble(
            game,
            roundNumber
        );


    if (latestDhumble) {

        const victimName =
            getAnnouncerPlayerName(
                latestDhumble.victim
            );


        const causers =
            Array.isArray(
                latestDhumble.causedBy
            )
                ? latestDhumble.causedBy
                : [];


        const causerNames =
            causers.map(id =>
                getAnnouncerPlayerName(id)
            );


        if (causerNames.length === 1) {

            parts.push(
                `${victimName} was Dhumbled by ${causerNames[0]}.`
            );

        }
        else if (
            causerNames.length > 1
        ) {

            parts.push(
                `${victimName} was Dhumbled by ${joinAnnouncerNames(causerNames)}.`
            );

        }
        else {

            parts.push(
                `${victimName} was Dhumbled.`
            );
        }
    }


    // --------------------------------------------------------
    // ACTIVE PLAYER SCORES
    //
    // IMPORTANT:
    // LOWEST SCORE → HIGHEST SCORE
    // --------------------------------------------------------

    const allPlayers =
        getAllGamePlayers(game);


    const activePlayers =
        allPlayers
            .filter(player =>

                player.status === "active" ||
                player.elimOrder === -1
            )

            .sort((a, b) => {

                const totalA =
                    Number(a.total) || 0;


                const totalB =
                    Number(b.total) || 0;


                return totalA - totalB;
            });


    if (activePlayers.length > 0) {

        parts.push(
            "Current scores."
        );


        activePlayers.forEach(player => {

            const name =
                getAnnouncerPlayerName(
                    player.id
                );


            const total =
                Number(player.total) || 0;


            parts.push(
                `${name}, ${total}.`
            );
        });
    }


    // --------------------------------------------------------
    // LATEST ELIMINATIONS
    // --------------------------------------------------------

    const latestEliminatedPlayers =
        getAnnouncerLatestEliminations(
            game
        );


    latestEliminatedPlayers.forEach(player => {

        const name =
            getAnnouncerPlayerName(
                player.id
            );


        const total =
            Number(player.total) || 0;


        parts.push(
            `${name} has been eliminated with ${total} points.`
        );
    });


    return parts
        .filter(Boolean)
        .join(" ");
}



// ============================================================
// GET CURRENT-ROUND DHUMBLE
// ============================================================

function getAnnouncerLatestDhumble(
    game,
    roundNumber
) {

    if (
        !Array.isArray(game.dhumbles) ||
        game.dhumbles.length === 0
    ) {

        return null;
    }


    return (
        game.dhumbles.find(
            dhumble =>
                Number(dhumble.round) ===
                Number(roundNumber)
        ) ||
        null
    );
}



// ============================================================
// GET LATEST ELIMINATION GROUP
// ============================================================

function getAnnouncerLatestEliminations(game) {

    if (
        !Array.isArray(game.eliminated) ||
        game.eliminated.length === 0
    ) {

        return [];
    }


    const eliminated =
        game.eliminated.filter(player =>

            player &&
            player.elimOrder !== -1 &&
            Number.isFinite(
                Number(player.elimOrder)
            )
        );


    if (eliminated.length === 0) {

        return [];
    }


    const latestOrder =
        Math.max(
            ...eliminated.map(player =>
                Number(player.elimOrder)
            )
        );


    return eliminated
        .filter(player =>
            Number(player.elimOrder) ===
            latestOrder
        )
        .sort(
            (a, b) =>
                (Number(a.total) || 0) -
                (Number(b.total) || 0)
        );
}



// ============================================================
// PLAYER NAME
// ============================================================

function getAnnouncerPlayerName(playerId) {

    const user =
        getUserById(
            Number(playerId)
        );


    if (
        user &&
        user.name
    ) {

        return user.name;
    }


    return "Unknown player";
}



// ============================================================
// NATURAL NAME LIST
// ============================================================

function joinAnnouncerNames(names) {

    if (!names.length) {

        return "";
    }


    if (names.length === 1) {

        return names[0];
    }


    if (names.length === 2) {

        return `${names[0]} and ${names[1]}`;
    }


    return (
        names
            .slice(0, -1)
            .join(", ") +

        `, and ${names[names.length - 1]}`
    );
}



// ============================================================
// FIND BEST AVAILABLE VOICE
// ============================================================
//
// Web Speech voices depend on the browser/device.
//
// Preference is given to voice names that are commonly
// higher-quality / natural-sounding.
//
// If none are available, we fall back to an English voice.
//
// ============================================================

// ============================================================
// 🎙️ ANNOUNCER VOICES
// ============================================================
//
// Each function below represents a different announcer.
//
// To change the announcer:
//
// 1. Go to getBestAnnouncerVoice()
// 2. Comment out the current return line
// 3. Uncomment the announcer you want
//
// DO NOT use voice indexes such as voices[9].
// Voice indexes can change between devices.
//
// ============================================================


// ============================================================
// 🇬🇧 ANNOUNCER 1
// GOOGLE UK ENGLISH MALE
// ============================================================

function announcerGoogleUKMale() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Google UK English Male"
        ) ||
        null
    );
}



// ============================================================
// 🇺🇸 ANNOUNCER 2
// MICROSOFT DAVID
// ============================================================

function announcerMicrosoftDavid() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft David - English (United States)"
        ) ||
        null
    );
}



// ============================================================
// 🇺🇸 ANNOUNCER 3
// MICROSOFT MARK
// ============================================================

function announcerMicrosoftMark() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft Mark - English (United States)"
        ) ||
        null
    );
}



// ============================================================
// 🇬🇧 ANNOUNCER 4
// MICROSOFT GEORGE
// ============================================================

function announcerMicrosoftGeorge() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft George - English (United Kingdom)"
        ) ||
        null
    );
}



// ============================================================
// 🇺🇸 ANNOUNCER 5
// GOOGLE US ENGLISH
//
// NOTE:
// On your computer this currently sounds female.
// Keeping it here in case you want it later.
// ============================================================

function announcerGoogleUSEnglish() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Google US English"
        ) ||
        null
    );
}



// ============================================================
// 🇬🇧 ANNOUNCER 6
// GOOGLE UK ENGLISH FEMALE
// ============================================================

function announcerGoogleUKFemale() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Google UK English Female"
        ) ||
        null
    );
}



// ============================================================
// 🇬🇧 ANNOUNCER 7
// MICROSOFT HAZEL
// ============================================================

function announcerMicrosoftHazel() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft Hazel - English (United Kingdom)"
        ) ||
        null
    );
}



// ============================================================
// 🇬🇧 ANNOUNCER 8
// MICROSOFT SUSAN
// ============================================================

function announcerMicrosoftSusan() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft Susan - English (United Kingdom)"
        ) ||
        null
    );
}



// ============================================================
// 🇺🇸 ANNOUNCER 9
// MICROSOFT ZIRA
// ============================================================

function announcerMicrosoftZira() {

    const voices =
        window.speechSynthesis.getVoices();


    return (
        voices.find(
            voice =>
                voice.name ===
                "Microsoft Zira - English (United States)"
        ) ||
        null
    );
}



// ============================================================
// 🎙️ ACTIVE ANNOUNCER
// ============================================================
//
// IMPORTANT:
//
// Leave ONLY ONE return line uncommented.
//
// Example:
//
// return announcerGoogleUKMale();
//
// To try Microsoft David:
//
// // return announcerGoogleUKMale();
// return announcerMicrosoftDavid();
//
// ============================================================

function getBestAnnouncerVoice() {


    // --------------------------------------------------------
    // 🇬🇧 MALE — GOOGLE
    // --------------------------------------------------------

    return announcerGoogleUKMale();


    // --------------------------------------------------------
    // 🇺🇸 MALE — MICROSOFT DAVID
    // --------------------------------------------------------

    // return announcerMicrosoftDavid();


    // --------------------------------------------------------
    // 🇺🇸 MALE — MICROSOFT MARK
    // --------------------------------------------------------

    // return announcerMicrosoftMark();


    // --------------------------------------------------------
    // 🇬🇧 MALE — MICROSOFT GEORGE
    // --------------------------------------------------------

    // return announcerMicrosoftGeorge();


    // --------------------------------------------------------
    // 🇺🇸 GOOGLE US ENGLISH
    // --------------------------------------------------------

    // return announcerGoogleUSEnglish();


    // --------------------------------------------------------
    // 🇬🇧 FEMALE — GOOGLE
    // --------------------------------------------------------

    // return announcerGoogleUKFemale();


    // --------------------------------------------------------
    // 🇬🇧 FEMALE — MICROSOFT HAZEL
    // --------------------------------------------------------

    // return announcerMicrosoftHazel();


    // --------------------------------------------------------
    // 🇬🇧 FEMALE — MICROSOFT SUSAN
    // --------------------------------------------------------

    // return announcerMicrosoftSusan();


    // --------------------------------------------------------
    // 🇺🇸 FEMALE — MICROSOFT ZIRA
    // --------------------------------------------------------

    // return announcerMicrosoftZira();
}


// ============================================================
// SPEAK ANNOUNCEMENT
// ============================================================

function speakAnnouncement(text) {

    if (!text) {

        return;
    }


    if (
        !("speechSynthesis" in window)
    ) {

        return;
    }


    // Stop existing speech.

    window.speechSynthesis.cancel();


    const speech =
        new SpeechSynthesisUtterance(
            text
        );


    // --------------------------------------------------------
    // VOICE SETTINGS
    // --------------------------------------------------------

    speech.rate =
        ANNOUNCER_RATE;


    speech.pitch =
        ANNOUNCER_PITCH;


    speech.volume =
        ANNOUNCER_VOLUME;


    // --------------------------------------------------------
    // NATURAL VOICE
    // --------------------------------------------------------

    const voice =
        getBestAnnouncerVoice();


    if (voice) {

        speech.voice =
            voice;


        speech.lang =
            voice.lang;


        console.log(
            "🔊 Announcer voice:",
            voice.name,
            voice.lang
        );
    }
    else {

        speech.lang =
            "en-US";
    }


    // --------------------------------------------------------
    // ERROR HANDLING
    // --------------------------------------------------------

    speech.onerror = event => {

        if (
            event.error !== "interrupted" &&
            event.error !== "canceled"
        ) {

            console.error(
                "Announcement speech error:",
                event.error
            );
        }
    };


    // --------------------------------------------------------
    // SPEAK
    // --------------------------------------------------------

    window.speechSynthesis.speak(
        speech
    );
}



// ============================================================
// INITIALIZE VOICES
// ============================================================

function initAnnouncerVoices() {

    if (
        !("speechSynthesis" in window)
    ) {

        return;
    }


    window.speechSynthesis.getVoices();


    window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {

            window.speechSynthesis.getVoices();

        }
    );
}



// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initAnnouncerVoices();

    }
);