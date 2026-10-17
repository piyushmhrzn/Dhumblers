
let predictionPoll = null;

let predictionVoterId = '';

let predictionBallot = null;

let monthlyPredictionBadges = {};

// Preserve unfinished selections during live updates.
let predictionDraft = {};

let predictionDraftVoterId = '';

let predictionCommunityExpanded = false;

let predictionCommunityTab = 'winner';

let predictionPollRequestId = 0;

let predictionVoterRequestId = 0;

let predictionSubmitting = false;

const PREDICTION_FIELDS = [
    ['winner', '🏆 Winner'],
    ['dhumbleVictim', '💀 First Dhumble'],
    ['highestScorer', '🔥 Highest Scorer'],
    ['firstEliminated', '☠️ First Eliminated']
];

const PREDICTION_BADGES = {
    2: {
        emoji: '🦜',
        name: 'Tukke Baaz'
    },
    3: {
        emoji: '🐍',
        name: 'Naag Jyotishi'
    },
    4: {
        emoji: '🧿',
        name: 'Dhumble Baba'
    }
};


// --------------------------------------------
// HELPERS
// --------------------------------------------

function predictionEscape(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]
    );
}

function predictionName(id) {
    return getUserById(Number(id))?.name ||
        `Player #${id}`;
}

async function predictionRequest(url, options) {
    const response = await fetch(url, options);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || 'Request failed'
        );
    }

    return data;
}

function predictionSaveDraft() {
    const form = document.getElementById(
        'predictionForm'
    );

    if (!form || !predictionVoterId) return;

    const draft = {};

    PREDICTION_FIELDS.forEach(([field]) => {
        const select = form.elements.namedItem(field);

        if (select) {
            draft[field] = select.value;
        }
    });

    predictionDraft = draft;
    predictionDraftVoterId = String(
        predictionVoterId
    );
}

function predictionClearDraft() {
    predictionDraft = {};
    predictionDraftVoterId = '';
}

function predictionSelectedValue(field) {
    if (
        predictionDraftVoterId ===
        String(predictionVoterId) &&
        Object.prototype.hasOwnProperty.call(
            predictionDraft,
            field
        )
    ) {
        return String(predictionDraft[field]);
    }

    const saved = predictionBallot?.[field];

    return saved === null ||
        saved === undefined
        ? ''
        : String(saved);
}


// --------------------------------------------
// LOAD CURRENT POLL
// --------------------------------------------

async function loadPredictionPoll() {
    const container = document.getElementById(
        'predictionContainer'
    );

    if (!container) return;

    const requestId = ++predictionPollRequestId;

    try {
        const data = await predictionRequest(
            '/api/predictions/ongoing'
        );

        // Ignore outdated responses.
        if (requestId !== predictionPollRequestId) {
            return;
        }

        // Preserve selections before replacing HTML.
        predictionSaveDraft();

        const previousGameId =
            predictionPoll?.game?.id;

        const nextGameId = data?.game?.id;

        // A new game should not inherit old picks.
        if (
            previousGameId !== undefined &&
            previousGameId !== null &&
            previousGameId !== nextGameId
        ) {
            predictionVoterRequestId++;

            predictionVoterId = '';
            predictionBallot = null;

            predictionClearDraft();

            predictionCommunityExpanded = false;
            predictionCommunityTab = 'winner';
        }

        predictionPoll = data;

        renderPredictionPoll();

    } catch (error) {
        if (requestId !== predictionPollRequestId) {
            return;
        }

        console.error(
            'Could not load prediction poll:',
            error
        );

        // Keep the existing form and selections
        // if a temporary refresh fails.
        if (!predictionPoll) {
            container.innerHTML = `
                <div class="alert alert-danger mb-0">
                    ${predictionEscape(error.message)}
                </div>
            `;
        }
    }
}


// --------------------------------------------
// SELECT REGISTERED VOTER
// --------------------------------------------

async function selectPredictionVoter(id) {
    if (predictionSubmitting) return;

    const voterId = String(id || '');

    const requestId = ++predictionVoterRequestId;

    predictionVoterId = voterId;

    predictionBallot = null;

    predictionClearDraft();

    if (!voterId) {
        renderPredictionPoll();
        return;
    }

    try {
        const data = await predictionRequest(
            `/api/predictions/ongoing/voter/${encodeURIComponent(voterId)
            }`
        );

        // Do not apply another voter's response.
        if (
            requestId !== predictionVoterRequestId ||
            predictionVoterId !== voterId
        ) {
            return;
        }

        predictionBallot = data.prediction;

        renderPredictionPoll();

    } catch (error) {
        if (requestId !== predictionVoterRequestId) {
            return;
        }

        alert(error.message);

        renderPredictionPoll();
    }
}


// --------------------------------------------
// COMMUNITY PREDICTION CHART
// --------------------------------------------

function renderPredictionCommunityChart() {
    const chart = document.getElementById(
        'predictionCommunityChart'
    );

    if (!chart || !predictionPoll?.game) return;

    const {
        game,
        voteCount,
        totals
    } = predictionPoll;

    const field = predictionCommunityTab;

    const selectedQuestion =
        PREDICTION_FIELDS.find(
            ([key]) => key === field
        );

    if (!selectedQuestion) return;

    const gamePlayers = game.players || [];

    const counts = totals?.[field] || {};

    let html = `
        <div class="fw-semibold small mb-3">
            ${selectedQuestion[1]}
        </div>
    `;

    if (!voteCount) {
        html += `
            <div class="text-secondary small py-2">
                No community votes yet.
                Predictions will appear here
                once ballots are submitted.
            </div>
        `;

        chart.innerHTML = html;
        return;
    }

    gamePlayers.forEach(player => {
        const count = Number(
            counts[player.id] || 0
        );

        const percent = Math.round(
            count / voteCount * 100
        );

        html += `
            <div class="mb-2">
                <div
                    class="d-flex justify-content-between
                           align-items-center small mb-1"
                >
                    <span>
                        ${predictionEscape(
            predictionName(player.id)
        )}
                    </span>

                    <span class="text-secondary">
                        ${percent}% (${count})
                    </span>
                </div>

                <div
                    class="progress"
                    style="height: 7px;"
                >
                    <div
                        class="progress-bar"
                        role="progressbar"
                        style="width: ${percent}%;"
                        aria-valuenow="${percent}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
            </div>
        `;
    });

    chart.innerHTML = html;
}

function selectPredictionCommunityTab(field) {
    const validField = PREDICTION_FIELDS.some(
        ([key]) => key === field
    );

    if (!validField) return;

    predictionCommunityTab = field;

    document.querySelectorAll(
        '[data-prediction-tab]'
    ).forEach(button => {
        const active =
            button.dataset.predictionTab === field;

        button.classList.toggle(
            'btn-primary',
            active
        );

        button.classList.toggle(
            'btn-outline-secondary',
            !active
        );

        button.setAttribute(
            'aria-selected',
            String(active)
        );
    });

    renderPredictionCommunityChart();
}

function togglePredictionCommunity() {
    predictionCommunityExpanded =
        !predictionCommunityExpanded;

    const panel = document.getElementById(
        'predictionCommunityPanel'
    );

    const icon = document.getElementById(
        'predictionCommunityChevron'
    );

    const toggle = document.getElementById(
        'predictionCommunityToggle'
    );

    if (panel) {
        panel.style.display =
            predictionCommunityExpanded
                ? 'block'
                : 'none';
    }

    if (icon) {
        icon.textContent =
            predictionCommunityExpanded
                ? '▲'
                : '▼';
    }

    if (toggle) {
        toggle.setAttribute(
            'aria-expanded',
            String(predictionCommunityExpanded)
        );
    }

    if (predictionCommunityExpanded) {
        renderPredictionCommunityChart();
    }
}


// --------------------------------------------
// RENDER PREDICTION CARD
// --------------------------------------------

function renderPredictionPoll() {
    const container = document.getElementById(
        'predictionContainer'
    );

    if (!container || !predictionPoll) return;

    // Don't replace the form during submission.
    if (predictionSubmitting) return;

    const {
        game,
        open,
        voteCount,
        totals
    } = predictionPoll;

    if (!game) {
        container.innerHTML = `
            <div
                class="d-flex align-items-center
                       justify-content-between gap-2"
            >
                <h5 class="mb-0">
                    🔮 Dhumble Predictions
                </h5>

                <span class="badge bg-secondary">
                    No Active Game
                </span>
            </div>

            <p class="text-secondary small mb-0 mt-2">
                Predictions open when a new game starts.
            </p>
        `;

        return;
    }

    const gamePlayers = game.players || [];

    const voterOptions = [...users]
        .sort((a, b) =>
            a.name.localeCompare(b.name)
        )
        .map(user => `
            <option
                value="${user.id}"
                ${String(user.id) ===
                String(predictionVoterId)
                ? 'selected'
                : ''
            }
            >
                ${predictionEscape(user.name)}
            </option>
        `)
        .join('');

    let html = `
        <div
            class="d-flex justify-content-between
                   align-items-center flex-wrap gap-2"
        >
            <h5 class="mb-0">
                🔮 Dhumble Predictions
            </h5>

            <span
                class="badge ${open
            ? 'bg-success'
            : 'bg-danger'
        }"
            >
                ${open
            ? 'Voting Open'
            : 'Voting Closed'
        }
            </span>
        </div>

        <div class="small text-secondary mt-2 mb-3">
            Game #${game.id}
            · ${voteCount || 0} ballot(s)
            · ${open
            ? 'Locks after Round 1 submission'
            : 'Round 1 has started'
        }
        </div>
    `;

    // ----------------------------------------
    // VOTING FORM
    // ----------------------------------------

    if (open) {
        html += `
            <div class="mb-3">
                <label
                    for="predictionVoterSelect"
                    class="form-label fw-semibold small mb-1"
                >
                    Vote as registered player
                </label>

                <select
                    class="form-select form-select-sm"
                    id="predictionVoterSelect"
                >
                    <option value="">
                        Select your name
                    </option>

                    ${voterOptions}
                </select>
            </div>
        `;

        if (predictionVoterId) {
            html += `
                <form id="predictionForm">

                    <div class="row g-2 mb-3">
            `;

            PREDICTION_FIELDS.forEach(
                ([field, label]) => {
                    const selected =
                        predictionSelectedValue(field);

                    html += `
                        <div class="col-6">
                            <label
                                class="form-label fw-semibold
                                       small mb-1"
                            >
                                ${label}
                            </label>

                            <select
                                class="form-select form-select-sm"
                                name="${field}"
                                required
                            >
                                <option value="">
                                    Pick player
                                </option>

                                ${gamePlayers.map(player => `
                                    <option
                                        value="${player.id}"
                                        ${selected ===
                            String(player.id)
                            ? 'selected'
                            : ''
                        }
                                    >
                                        ${predictionEscape(
                            predictionName(
                                player.id
                            )
                        )}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    `;
                }
            );

            html += `
                    </div>

                    <button
                        type="submit"
                        class="btn btn-primary btn-sm w-100"
                    >
                        ${predictionBallot
                    ? '🎯 Update My Predictions'
                    : '🎯 Submit My Predictions'
                }
                    </button>

                </form>
            `;
        }
    }

    // ----------------------------------------
    // COMMUNITY PREDICTIONS
    // ----------------------------------------

    html += `
        <div class="mt-3 pt-3 border-top">

            <button
                type="button"
                id="predictionCommunityToggle"
                class="btn btn-link text-decoration-none
                       p-0 w-100 text-start"
                aria-expanded="${predictionCommunityExpanded
        }"
            >
                <span
                    class="d-flex align-items-center
                           justify-content-between"
                >
                    <span class="fw-semibold">
                        📊 Community Predictions
                    </span>

                    <span
                        id="predictionCommunityChevron"
                        class="small text-secondary"
                    >
                        ${predictionCommunityExpanded
            ? '▲'
            : '▼'
        }
                    </span>
                </span>
            </button>

            <div
                id="predictionCommunityPanel"
                class="mt-3"
                style="display: ${predictionCommunityExpanded
            ? 'block'
            : 'none'
        };"
            >
                <div
                    class="d-flex gap-2 mb-3"
                    role="tablist"
                    aria-label="Community prediction categories"
                >
    `;

    PREDICTION_FIELDS.forEach(
        ([field, label]) => {
            const active =
                predictionCommunityTab === field;

            const emoji = label.split(' ')[0];

            html += `
                <button
                    type="button"
                    class="btn btn-sm flex-fill ${active
                    ? 'btn-primary'
                    : 'btn-outline-secondary'
                }"
                    data-prediction-tab="${field}"
                    role="tab"
                    aria-label="${predictionEscape(label)}"
                    aria-selected="${active}"
                    title="${predictionEscape(label)}"
                >
                    ${emoji}
                </button>
            `;
        }
    );

    html += `
                </div>

                <div
                    id="predictionCommunityChart"
                    role="tabpanel"
                ></div>

            </div>

        </div>
    `;

    container.innerHTML = html;

    // ----------------------------------------
    // EVENT LISTENERS
    // ----------------------------------------

    const voterSelect = document.getElementById(
        'predictionVoterSelect'
    );

    if (voterSelect) {
        voterSelect.addEventListener(
            'change',
            event => {
                selectPredictionVoter(
                    event.target.value
                );
            }
        );
    }

    const form = document.getElementById(
        'predictionForm'
    );

    if (form) {
        form.addEventListener(
            'change',
            predictionSaveDraft
        );

        form.addEventListener(
            'submit',
            submitPredictionBallot
        );
    }

    const communityToggle =
        document.getElementById(
            'predictionCommunityToggle'
        );

    if (communityToggle) {
        communityToggle.addEventListener(
            'click',
            togglePredictionCommunity
        );
    }

    document.querySelectorAll(
        '[data-prediction-tab]'
    ).forEach(button => {
        button.addEventListener(
            'click',
            () => {
                selectPredictionCommunityTab(
                    button.dataset.predictionTab
                );
            }
        );
    });

    if (predictionCommunityExpanded) {
        renderPredictionCommunityChart();
    }
}


// --------------------------------------------
// SUBMIT OR UPDATE BALLOT
// --------------------------------------------

async function submitPredictionBallot(event) {
    event.preventDefault();

    if (!predictionVoterId) return;

    if (predictionSubmitting) return;

    const form = event.currentTarget;

    const formData = new FormData(form);

    const ballot = {
        voterId: Number(predictionVoterId)
    };

    PREDICTION_FIELDS.forEach(([field]) => {
        ballot[field] = Number(
            formData.get(field)
        );
    });

    const button = form.querySelector(
        'button[type="submit"]'
    );

    predictionSubmitting = true;

    if (button) {
        button.disabled = true;
    }

    try {
        await predictionRequest(
            '/api/predictions/ongoing',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ballot)
            }
        );

        predictionClearDraft();

        // Allow the refreshed poll to render.
        predictionSubmitting = false;

        await loadPredictionPoll();

        await selectPredictionVoter(
            predictionVoterId
        );

        alert(
            '🗳️ Your predictions have been saved!'
        );

    } catch (error) {
        predictionSubmitting = false;

        alert(error.message);

        // Keep unfinished selections for retry.
        predictionSaveDraft();

        await loadPredictionPoll();

    } finally {
        predictionSubmitting = false;

        if (button) {
            button.disabled = false;
        }
    }
}


// --------------------------------------------
// MONTHLY PREDICTION BADGES
// --------------------------------------------

async function loadMonthlyPredictionBadges() {
    try {
        const data = await predictionRequest(
            '/api/predictions/badges/monthly'
        );

        monthlyPredictionBadges =
            data.badges || {};

        // Refresh leaderboard only after game history has loaded.
        // Prevents "No games played this month" from flashing.
        if (
            typeof renderLeaderboard === 'function' &&
            Array.isArray(games) &&
            games.length > 0
        ) {
            const leaderboardBody =
                document.getElementById('leaderboardBody');

            if (leaderboardBody) {
                renderLeaderboard(leaderboardBody);
            }
        }

    } catch (error) {
        console.error(
            'Could not load prediction badges:',
            error
        );
    }
}


// Returns a compact achievement chip beside
// the player's name in the monthly leaderboard.

function getMonthlyPredictionBadgeHTML(playerId) {
    const badge =
        monthlyPredictionBadges[playerId];

    if (!badge) return '';

    const score =
        typeof badge === 'number'
            ? badge
            : Number(
                badge.score ??
                badge.correctCount ??
                badge.bestScore
            );

    const info = PREDICTION_BADGES[score];

    if (!info) return '';

    return `
        <span
            class="prediction-achievement-chip"
            title="${info.name} (${score}/4 correct)"
            aria-label="${info.name}"
        >
            ${info.emoji}
        </span>
    `;
}


// --------------------------------------------
// SOCKET.IO UPDATE HANDLER
// --------------------------------------------

// Called from the existing Socket.IO
// connection in live.js.

function handlePredictionGameUpdate() {
    loadPredictionPoll();
}


// --------------------------------------------
// INITIALIZATION
// --------------------------------------------

// The existing homepage initialization
// loads users asynchronously and then
// triggers the prediction poll loading.

document.addEventListener(
    'DOMContentLoaded',
    () => {
        // Initialization remains controlled
        // by your existing homepage code.
    }
);
