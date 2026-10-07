// ================================================
// 🏛️ DHUMBLE HALL OF FAME
// All-Time Records
// ================================================
//
// RECORD RULES:
//
// • Game-derived Hall of Fame records:
//      Completed games with 6+ rounds only.
//
// • Highest Single-Round Score:
//      Completed games with 6+ rounds
//      AND score must be below 75.
//
// • Highest Win Rate / Highest Prestige Tier:
//      Use ALL completed career games so these
//      match the existing Career Stats.
//
// • Rate / Tier records require 10+ career games.
//
// ================================================


const RECORDS_MIN_ROUNDS = 6;
const RECORDS_MAX_REAL_ROUND_SCORE = 75;
const RECORDS_MIN_GAMES_FOR_RATE = 10;


// ================================================
// MAIN RENDER
// ================================================

function renderRecords() {

    const container =
        document.getElementById("recordsContent");

    if (!container) {
        return;
    }


    // ------------------------------------------------
    // ALL COMPLETED GAMES
    //
    // Used specifically for career Win Rate
    // and Prestige Tier so those records match
    // the existing Career Stats.
    // ------------------------------------------------

    const allCompletedGames =
        (games || []).filter(game =>
            game &&
            game.status === "completed"
        );


    // ------------------------------------------------
    // VALID HALL OF FAME GAMES
    //
    // Short test games are excluded from
    // game-derived records.
    // ------------------------------------------------

    const validGames =
        allCompletedGames.filter(game =>
            Array.isArray(game.rounds) &&
            game.rounds.length >= RECORDS_MIN_ROUNDS
        );


    if (allCompletedGames.length === 0) {

        container.innerHTML = `
            <div class="text-center text-secondary py-4">
                No completed games yet.
            </div>
        `;

        return;
    }


    // ------------------------------------------------
    // BUILD STATS
    // ------------------------------------------------

    const recordStats =
        buildRecordsCareerStats(validGames);


    const fullCareerStats =
        buildRecordsFullCareerStats(
            allCompletedGames
        );


    // ------------------------------------------------
    // BUILD RECORD SECTIONS
    // ------------------------------------------------

    const careerRecords =
        buildCareerRecords(
            recordStats,
            fullCareerStats,
            validGames
        );


    const dhumbleRecords =
        buildDhumbleRecords(
            recordStats
        );


    const gameRecords =
        buildGameRecords(
            validGames
        );


    const bonusRecords =
        buildBonusRecords(
            recordStats
        );


    // ------------------------------------------------
    // RENDER
    // ------------------------------------------------

    container.innerHTML = `

        ${renderRecordSection(
        "🏆 Career Records",
        careerRecords
    )}

        ${renderRecordSection(
        "💀 Dhumble Records",
        dhumbleRecords
    )}

        ${renderRecordSection(
        "🎯 Game Records",
        gameRecords
    )}

        ${renderRecordSection(
        "🎁 Winner Bonus Records",
        bonusRecords
    )}

    `;
}



// ================================================
// BUILD FILTERED RECORD STATS
//
// Used for:
// 1st / 2nd / 3rd
// Games Played
// Career Points
// Dhumble records
// Bonus records
//
// ================================================

function buildRecordsCareerStats(validGames) {

    const stats = {};


    function ensurePlayer(playerId) {

        playerId =
            Number(playerId);


        if (!stats[playerId]) {

            stats[playerId] = {

                id:
                    playerId,

                games:
                    0,

                wins:
                    0,

                secondPlaces:
                    0,

                thirdPlaces:
                    0,

                careerPoints:
                    0,


                // ------------------------------------
                // DHUMBLE
                // ------------------------------------

                dhumblesCaused:
                    0,

                dhumblesReceived:
                    0,

                maxDhumblesCausedGame:
                    0,

                maxDhumblesReceivedGame:
                    0,


                // ------------------------------------
                // WINNER BONUS
                // ------------------------------------

                bonusWins:
                    0,

                clutchWins:
                    0,

                dominatingWins:
                    0,

                multiEliminationWins:
                    0
            };
        }


        return stats[playerId];
    }


    // ------------------------------------------------
    // PROCESS VALID GAMES
    // ------------------------------------------------

    validGames.forEach(game => {

        const rankings =
            getRecordsGameRankings(game);


        // --------------------------------------------
        // CAREER / PLACEMENT
        // --------------------------------------------

        rankings.forEach(player => {

            const playerStats =
                ensurePlayer(player.id);


            playerStats.games++;


            playerStats.careerPoints +=
                Number(player.points) || 0;


            if (player.place === 1) {

                playerStats.wins++;
            }


            if (player.place === 2) {

                playerStats.secondPlaces++;
            }


            if (player.place === 3) {

                playerStats.thirdPlaces++;
            }
        });


        // --------------------------------------------
        // DHUMBLE
        // --------------------------------------------

        const causedThisGame = {};
        const receivedThisGame = {};


        (game.dhumbles || []).forEach(dhumble => {

            const victimId =
                Number(dhumble.victim);


            const causedBy =
                Array.isArray(dhumble.causedBy)

                    ? dhumble.causedBy.map(Number)

                    : [];


            // One Dhumble event received,
            // regardless of number of causers.

            const victimStats =
                ensurePlayer(victimId);


            victimStats.dhumblesReceived++;


            receivedThisGame[victimId] =
                (receivedThisGame[victimId] || 0) + 1;


            // Every attributed causer gets credit.

            causedBy.forEach(causerId => {

                const causerStats =
                    ensurePlayer(causerId);


                causerStats.dhumblesCaused++;


                causedThisGame[causerId] =
                    (causedThisGame[causerId] || 0) + 1;
            });
        });


        // --------------------------------------------
        // MOST CAUSED IN ONE GAME
        // --------------------------------------------

        Object.entries(causedThisGame)
            .forEach(([id, count]) => {

                const playerStats =
                    ensurePlayer(Number(id));


                playerStats.maxDhumblesCausedGame =
                    Math.max(
                        playerStats.maxDhumblesCausedGame,
                        count
                    );
            });


        // --------------------------------------------
        // MOST RECEIVED IN ONE GAME
        // --------------------------------------------

        Object.entries(receivedThisGame)
            .forEach(([id, count]) => {

                const playerStats =
                    ensurePlayer(Number(id));


                playerStats.maxDhumblesReceivedGame =
                    Math.max(
                        playerStats.maxDhumblesReceivedGame,
                        count
                    );
            });


        // --------------------------------------------
        // WINNER BONUS RECORDS
        // --------------------------------------------

        const winner =
            rankings.find(
                player =>
                    player.place === 1
            );


        if (winner) {

            const winnerStats =
                ensurePlayer(winner.id);


            const bonusPoints =
                Number(winner.bonusPoints) || 0;


            const bonusName =
                winner.bonusName || "";


            if (bonusPoints > 0) {

                winnerStats.bonusWins++;
            }


            if (
                bonusName.includes(
                    "Clutch Win"
                )
            ) {

                winnerStats.clutchWins++;
            }


            if (
                bonusName.includes(
                    "Dominating Win"
                )
            ) {

                winnerStats.dominatingWins++;
            }


            if (
                bonusName.includes(
                    "Multi-Elimination"
                )
            ) {

                winnerStats.multiEliminationWins++;
            }
        }
    });


    return stats;
}



// ================================================
// FULL CAREER STATS
//
// IMPORTANT:
//
// Win Rate and Prestige Tier use this.
//
// There is NO 6-round filter here.
//
// This is intentional so these records match
// Player Career Stats.
//
// ================================================

function buildRecordsFullCareerStats(
    allCompletedGames
) {

    const stats = {};


    function ensurePlayer(playerId) {

        playerId =
            Number(playerId);


        if (!stats[playerId]) {

            stats[playerId] = {

                id:
                    playerId,

                games:
                    0,

                wins:
                    0,

                totalPoints:
                    0,

                avgPoints:
                    0,

                winRate:
                    0
            };
        }


        return stats[playerId];
    }


    allCompletedGames.forEach(game => {

        getAllGamePlayers(game)
            .forEach(player => {

                const playerStats =
                    ensurePlayer(player.id);


                playerStats.games++;


                playerStats.totalPoints +=
                    Number(player.points) || 0;


                if (
                    player.elimOrder === -1
                ) {

                    playerStats.wins++;
                }
            });
    });


    Object.values(stats)
        .forEach(player => {

            player.avgPoints =
                player.games > 0

                    ? player.totalPoints /
                    player.games

                    : 0;


            player.winRate =
                player.games > 0

                    ? player.wins /
                    player.games

                    : 0;
        });


    return stats;
}



// ================================================
// REBUILD FINAL GAME RANKING
//
// Same logic as backend.
//
// Winner first.
//
// Then:
// 1. Later elimination order = higher.
// 2. Same elimination round:
//    lower final total = higher.
// 3. Same elimOrder + same total = tie.
//
// Competition ranking:
//
// 1
// 2
// 2
// 4
//
// ================================================

function getRecordsGameRankings(game) {

    const allPlayers =
        getAllGamePlayers(game);


    const winner =
        allPlayers.find(
            player =>
                player.elimOrder === -1
        );


    const eliminated =
        allPlayers
            .filter(
                player =>
                    player.id !== winner?.id
            )
            .sort((a, b) => {

                if (
                    Number(a.elimOrder) !==
                    Number(b.elimOrder)
                ) {

                    return (
                        Number(b.elimOrder) -
                        Number(a.elimOrder)
                    );
                }


                return (
                    (Number(a.total) || 0) -
                    (Number(b.total) || 0)
                );
            });


    const rankings =
        winner

            ? [winner, ...eliminated]

            : [...eliminated];


    let previousPlace = 0;


    return rankings.map(
        (player, index) => {

            let place;


            if (index === 0) {

                place = 1;

            }
            else {

                const previous =
                    rankings[index - 1];


                const tied =
                    Number(player.elimOrder) ===
                    Number(previous.elimOrder) &&

                    Number(player.total) ===
                    Number(previous.total);


                if (tied) {

                    place =
                        previousPlace;

                }
                else {

                    place =
                        index + 1;
                }
            }


            previousPlace =
                place;


            return {

                id:
                    Number(player.id),

                place,

                total:
                    Number(player.total) || 0,

                points:
                    Number(player.points) || 0,

                elimOrder:
                    player.elimOrder,

                bonusPoints:
                    Number(player.bonusPoints) || 0,

                bonusName:
                    player.bonusName || ""
            };
        }
    );
}



// ================================================
// CAREER RECORDS
// ================================================

function buildCareerRecords(
    filteredStats,
    fullCareerStats,
    validGames
) {

    const filteredPlayers =
        Object.values(filteredStats);


    const fullCareerPlayers =
        Object.values(fullCareerStats);


    return [

        // --------------------------------------------
        // MOST FIRST PLACES
        // --------------------------------------------

        makeMaxRecord(

            "👑",

            "Most 1st Places",

            filteredPlayers,

            player =>
                player.wins,

            value =>
                `${value} Wins`
        ),


        // --------------------------------------------
        // MOST SECOND PLACES
        // --------------------------------------------

        makeMaxRecord(

            "🥈",

            "Most 2nd Places",

            filteredPlayers,

            player =>
                player.secondPlaces,

            value =>
                `${value} Second Places`
        ),


        // --------------------------------------------
        // MOST THIRD PLACES
        // --------------------------------------------

        makeMaxRecord(

            "🥉",

            "Most 3rd Places",

            filteredPlayers,

            player =>
                player.thirdPlaces,

            value =>
                `${value} Third Places`
        ),


        // --------------------------------------------
        // MOST GAMES
        // --------------------------------------------

        makeMaxRecord(

            "🎮",

            "Most Games Played",

            filteredPlayers,

            player =>
                player.games,

            value =>
                `${value} Games`
        ),


        // --------------------------------------------
        // MOST CAREER POINTS
        // --------------------------------------------

        makeMaxRecord(

            "⭐",

            "Most Career Points",

            filteredPlayers,

            player =>
                player.careerPoints,

            value =>
                `${value} Points`
        ),


        // --------------------------------------------
        // HIGHEST WIN RATE
        //
        // IMPORTANT:
        // Uses FULL career games.
        // --------------------------------------------

        makeMaxRecord(

            "📈",

            "Highest Win Rate",

            fullCareerPlayers.filter(
                player =>
                    player.games >=
                    RECORDS_MIN_GAMES_FOR_RATE
            ),

            player =>
                player.winRate * 100,

            value =>
                `${value.toFixed(2)}%`
        ),


        // --------------------------------------------
        // HIGHEST POINTS / GAME
        // --------------------------------------------

        // makeMaxRecord(

        //     "🎯",

        //     "Highest Points / Game",

        //     fullCareerPlayers.filter(
        //         player =>
        //             player.games >=
        //             RECORDS_MIN_GAMES_FOR_RATE
        //     ),

        //     player =>
        //         player.avgPoints,

        //     value =>
        //         value.toFixed(2)
        // ),


        // --------------------------------------------
        // HIGHEST PRESTIGE
        // --------------------------------------------

        buildHighestTierRecord(
            fullCareerPlayers
        ),


        // --------------------------------------------
        // LONGEST WIN STREAK
        // --------------------------------------------

        buildLongestWinStreakRecord(
            filteredPlayers,
            validGames
        )
    ];
}



// ================================================
// HIGHEST PRESTIGE TIER
//
// Uses FULL career statistics.
//
// Same requirements:
// • win rate
// • average points
// • minimum 10 games
//
// ================================================

function buildHighestTierRecord(
    fullCareerPlayers
) {

    const eligible =
        fullCareerPlayers.filter(
            player =>
                player.games >=
                RECORDS_MIN_GAMES_FOR_RATE
        );


    if (eligible.length === 0) {

        return {

            icon:
                "💎",

            title:
                "Highest Prestige Tier",

            names:
                ["—"],

            value:
                "N/A",

            note:
                ""
        };
    }


    const results =
        eligible.map(player => {

            // ----------------------------------------
            // Find prestige tier directly using the
            // SAME TIERS requirements.
            // ----------------------------------------

            const tier =
                [...TIERS]
                    .reverse()
                    .find(tier =>

                        player.winRate >=
                        tier.win &&

                        Number(
                            player.avgPoints
                        ) >=
                        tier.avg
                    );


            const tierName =
                tier
                    ? tier.name
                    : "🪱 Compost";


            const tierIndex =
                tier
                    ? TIERS.findIndex(
                        item =>
                            item.name ===
                            tier.name
                    )
                    : 0;


            return {

                id:
                    player.id,

                tierName,

                tierIndex
            };
        });


    const highestIndex =
        Math.max(
            ...results.map(
                result =>
                    result.tierIndex
            )
        );


    const winners =
        results.filter(
            result =>
                result.tierIndex ===
                highestIndex
        );


    return {

        icon:
            "💎",

        title:
            "Highest Prestige Tier",

        names:
            winners.map(
                winner =>
                    getRecordsPlayerName(
                        winner.id
                    )
            ),

        value:
            winners[0]?.tierName ||
            "N/A",

        note:
            ""
    };
}



// ================================================
// LONGEST WIN STREAK
// ================================================

function buildLongestWinStreakRecord(
    players,
    validGames
) {

    let bestStreak = 0;

    let bestPlayerIds = [];


    players.forEach(player => {

        const playerGames =
            validGames
                .filter(game =>

                    getAllGamePlayers(game)
                        .some(p =>
                            Number(p.id) ===
                            Number(player.id)
                        )
                )
                .slice()
                .sort(
                    (a, b) =>
                        new Date(a.date) -
                        new Date(b.date)
                );


        let currentStreak = 0;
        let longestStreak = 0;


        playerGames.forEach(game => {

            const won =
                getAllGamePlayers(game)
                    .some(p =>

                        Number(p.id) ===
                        Number(player.id) &&

                        p.elimOrder === -1
                    );


            if (won) {

                currentStreak++;


                longestStreak =
                    Math.max(
                        longestStreak,
                        currentStreak
                    );

            }
            else {

                currentStreak = 0;
            }
        });


        if (
            longestStreak >
            bestStreak
        ) {

            bestStreak =
                longestStreak;


            bestPlayerIds =
                [player.id];

        }
        else if (
            longestStreak ===
            bestStreak &&
            longestStreak > 0
        ) {

            bestPlayerIds.push(
                player.id
            );
        }
    });


    return {

        icon:
            "🔥",

        title:
            "Longest Win Streak",

        names:
            bestPlayerIds.length

                ? bestPlayerIds.map(
                    getRecordsPlayerName
                )

                : ["—"],

        value:
            `${bestStreak} Wins`
    };
}



// ================================================
// DHUMBLE RECORDS
// ================================================

function buildDhumbleRecords(stats) {

    const players =
        Object.values(stats);


    return [

        makeMaxRecord(

            "💀",

            "Most Dhumbles Caused",

            players,

            player =>
                player.dhumblesCaused,

            value =>
                `${value} Dhumbles`
        ),


        makeMaxRecord(

            "🎯",

            "Most Dhumbled",

            players,

            player =>
                player.dhumblesReceived,

            value =>
                `${value} Times`
        ),


        // makeMaxRecord(

        //     "😈",

        //     "Most Dhumbles Caused — One Game",

        //     players,

        //     player =>
        //         player.maxDhumblesCausedGame,

        //     value =>
        //         `${value} Dhumbles`
        // ),


        // makeMaxRecord(

        //     "☠️",

        //     "Most Dhumbles Received — One Game",

        //     players,

        //     player =>
        //         player.maxDhumblesReceivedGame,

        //     value =>
        //         `${value} Dhumbles`
        // )
    ];
}



// ================================================
// GAME RECORDS
// ================================================

function buildGameRecords(validGames) {

    return [

        buildHighestRoundScoreRecord(
            validGames
        ),


        buildLowestWinningTotalRecord(
            validGames
        )
    ];
}



// ================================================
// HIGHEST SINGLE-ROUND SCORE
// ================================================

function buildHighestRoundScoreRecord(
    validGames
) {

    let highestScore =
        -Infinity;


    let holders = [];


    validGames.forEach(game => {

        (game.rounds || [])
            .forEach(
                (round, roundIndex) => {

                    Object.entries(
                        round || {}
                    )
                        .forEach(
                            ([id, rawScore]) => {

                                const score =
                                    Number(rawScore);


                                if (
                                    !Number.isFinite(score)
                                ) {

                                    return;
                                }


                                // --------------------------------
                                // TEST SCORE FILTER
                                //
                                // 70+ does NOT count.
                                // --------------------------------

                                if (
                                    score >=
                                    RECORDS_MAX_REAL_ROUND_SCORE
                                ) {

                                    return;
                                }


                                if (
                                    score >
                                    highestScore
                                ) {

                                    highestScore =
                                        score;


                                    holders = [{

                                        id:
                                            Number(id),

                                        gameId:
                                            game.id,

                                        round:
                                            roundIndex + 1
                                    }];

                                }
                                else if (
                                    score ===
                                    highestScore
                                ) {

                                    holders.push({

                                        id:
                                            Number(id),

                                        gameId:
                                            game.id,

                                        round:
                                            roundIndex + 1
                                    });
                                }
                            }
                        );
                }
            );
    });


    if (
        !Number.isFinite(
            highestScore
        )
    ) {

        return {

            icon:
                "🤡",

            title:
                "Highest Single-Round Score",

            names:
                ["—"],

            value:
                "N/A"
        };
    }


    const uniqueNames =
        [...new Set(
            holders.map(holder =>
                getRecordsPlayerName(
                    holder.id
                )
            )
        )];


    let detail =
        `${highestScore} Points`;


    if (
        holders.length === 1
    ) {

        const holder =
            holders[0];


        detail +=
            ` • Round ${holder.round}`;


        if (
            holder.gameId != null
        ) {

            detail +=
                ` • Game #${holder.gameId}`;
        }
    }


    return {

        icon:
            "🤡",

        title:
            "Highest Single-Round Score",

        names:
            uniqueNames,

        value:
            detail,

        note:
            ``
    };
}



// ================================================
// LOWEST WINNING TOTAL
//
// IMPORTANT:
//
// Uses the actual saved winner.
//
// Only completed games with 6+ rounds.
//
// ================================================

function buildLowestWinningTotalRecord(
    validGames
) {

    let lowestTotal =
        Infinity;


    let holders = [];


    validGames.forEach(game => {

        const allPlayers =
            getAllGamePlayers(game);


        const winner =
            allPlayers.find(
                player =>
                    player.elimOrder === -1
            );


        if (!winner) {

            return;
        }


        const total =
            Number(winner.total);


        if (
            !Number.isFinite(total)
        ) {

            return;
        }


        if (
            total <
            lowestTotal
        ) {

            lowestTotal =
                total;


            holders = [{

                id:
                    Number(winner.id),

                gameId:
                    game.id
            }];

        }
        else if (
            total ===
            lowestTotal
        ) {

            holders.push({

                id:
                    Number(winner.id),

                gameId:
                    game.id
            });
        }
    });


    if (
        !Number.isFinite(
            lowestTotal
        )
    ) {

        return {

            icon:
                "🏆",

            title:
                "Lowest Winning Total",

            names:
                ["—"],

            value:
                "N/A"
        };
    }


    const uniqueNames =
        [...new Set(
            holders.map(holder =>
                getRecordsPlayerName(
                    holder.id
                )
            )
        )];


    let detail =
        `${lowestTotal} Points`;


    if (
        holders.length === 1 &&
        holders[0].gameId != null
    ) {

        detail +=
            ` • Game #${holders[0].gameId}`;
    }


    return {

        icon:
            "🏆",

        title:
            "Lowest Winning Total",

        names:
            uniqueNames,

        value:
            detail,

        note:
            ``
    };
}



// ================================================
// BONUS RECORDS
// ================================================

function buildBonusRecords(stats) {

    const players =
        Object.values(stats);


    return [

        makeMaxRecord(

            "🎊",

            "Most Bonus Wins",

            players,

            player =>
                player.bonusWins,

            value =>
                `${value} Wins`,

            "Games won with at least one winner bonus"
        ),


        makeMaxRecord(

            "🩸",

            "Most Clutch Wins",

            players,

            player =>
                player.clutchWins,

            value =>
                `${value} Wins`,

            "Games won when score was from 146–149"
        ),


        makeMaxRecord(

            "🧹",

            "Most Dominating Wins",

            players,

            player =>
                player.dominatingWins,

            value =>
                `${value} Wins`,

            "Games won when score was 100 or below"
        ),


        makeMaxRecord(

            "💥",

            "Most Multi-Elimination Wins",

            players,

            player =>
                player.multiEliminationWins,

            value =>
                `${value} Wins`,

            "Games won when 2 or more players eliminated in final round"
        )
    ];
}



// ================================================
// GENERIC MAX RECORD
// ================================================

function makeMaxRecord(
    icon,
    title,
    players,
    getValue,
    formatValue,
    note = ""
) {

    if (
        !players ||
        players.length === 0
    ) {

        return {

            icon,

            title,

            names:
                ["—"],

            value:
                "N/A",

            note
        };
    }


    const values =
        players.map(player =>
            Number(
                getValue(player)
            ) || 0
        );


    const maxValue =
        Math.max(...values);


    const winners =
        players.filter(player => {

            const value =
                Number(
                    getValue(player)
                ) || 0;


            return (
                Math.abs(
                    value -
                    maxValue
                ) <
                0.000001
            );
        });


    return {

        icon,

        title,

        names:
            winners.map(player =>
                getRecordsPlayerName(
                    player.id
                )
            ),

        value:
            formatValue(
                maxValue
            ),

        note
    };
}



// ================================================
// PLAYER NAME
// ================================================

function getRecordsPlayerName(
    playerId
) {

    return (
        getUserById(
            Number(playerId)
        )?.name ||
        "Unknown"
    );
}



// ================================================
// RENDER ONE RECORD SECTION
// ================================================

function renderRecordSection(
    title,
    records
) {

    let html = `

        <div class="mt-4">

            <h6 class="border-bottom pb-2 mb-3">

                ${title}

            </h6>


            <div class="row g-3">
    `;


    records.forEach(record => {

        const names =
            record.names &&
                record.names.length

                ? record.names.join(" & ")

                : "—";


        html += `

            <div class="col-xl-3 col-lg-4 col-md-6">

                <div
                    class="
                        border
                        rounded
                        p-3
                        h-100
                        text-center
                    "
                >

                    <div class="fs-3 mb-1">

                        ${record.icon}

                    </div>


                    <div
                        class="
                            text-secondary
                            small
                            text-uppercase
                        "
                    >

                        ${record.title}

                    </div>


                    <div class="fw-bold fs-5 mt-2">

                        ${names}

                    </div>


                    <div class="small mt-1">

                        ${record.value}

                    </div>


                    ${record.note

                ? `
                                <div
                                    class="
                                        text-secondary
                                        small
                                        mt-2
                                    "
                                >
                                    ${record.note}
                                </div>
                            `

                : ""
            }

                </div>

            </div>
        `;
    });


    html += `

            </div>

        </div>
    `;


    return html;
}