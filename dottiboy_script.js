// --- ゲーム設定と状態 ---
const multipliers = [16, 8, 4, 4, 8, 16]; 

// プレイヤー管理
let players = []; 
let parentIndex = 0; 
let roundCount = 1; 

// ゲーム進行用
let currentLevel = 0;
let currentIndex = 0;
let isParentTurn = false;

// ベット管理用
let bettingQueue = [];
let currentBetterIndex = -1;
let playerBets = {}; 

// カテゴリ設定用
let selectedCategoryKey = "all"; // 初期値

// HTML要素の取得
const setupOverlay = document.getElementById("setup-overlay");
const playerInputList = document.getElementById("player-input-list");
const categorySelect = document.getElementById("category-select"); // 追加

const pyramidBoard = document.getElementById("pyramid-board");
const resultRow = document.getElementById("result-row");
const gameStatus = document.getElementById("game-status");
const instructionText = document.getElementById("instruction-text");
const nextRoundBtn = document.getElementById("next-round-btn");
const playerListUI = document.getElementById("player-list");

const bettingControls = document.getElementById("betting-controls");
const currentBetterNameUI = document.getElementById("current-better-name");
const betAmountInput = document.getElementById("bet-amount");

// 履歴用要素
const historyOverlay = document.getElementById("history-overlay");
const historyTitle = document.getElementById("history-title");
const historyListBody = document.getElementById("history-list-body");
const closeHistoryBtn = document.getElementById("close-history-btn");

// --- 1. セットアップ ---
document.addEventListener("DOMContentLoaded", () => {
    // カテゴリ選択肢の生成
    initCategorySelect();

    document.getElementById("add-player-btn").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "player-name-input";
        input.placeholder = `プレイヤー${playerInputList.children.length + 1}`;
        input.value = `プレイヤー${playerInputList.children.length + 1}`;
        playerInputList.appendChild(input);
    });

    document.getElementById("start-game-btn").addEventListener("click", finishSetup);
    nextRoundBtn.addEventListener("click", startRound);
    closeHistoryBtn.addEventListener("click", () => {
        historyOverlay.style.display = "none";
    });
});

// カテゴリプルダウンの初期化
function initCategorySelect() {
    // まず「全ジャンルMIX」を追加
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "🌏 全ジャンルMIX";
    categorySelect.appendChild(allOption);

    // questionCategoriesから選択肢を作成
    if (typeof questionCategories !== 'undefined') {
        for (const [key, data] of Object.entries(questionCategories)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = data.title;
            categorySelect.appendChild(option);
        }
    }
}

function finishSetup() {
    const initChips = parseInt(document.getElementById("init-chips").value) || 100;
    const inputs = document.querySelectorAll(".player-name-input");
    
    // 選択されたカテゴリを保存
    selectedCategoryKey = categorySelect.value;

    players = [];
    inputs.forEach(input => {
        if(input.value.trim() !== "") {
            players.push({ 
                name: input.value.trim(), 
                chips: initChips,
                history: [{ round: "-", reason: "初期所持", diff: 0, balance: initChips }]
            });
        }
    });

    if (players.length < 2) {
        alert("プレイヤーは最低2人必要です！");
        return;
    }
    
    parentIndex = Math.floor(Math.random() * players.length);
    roundCount = 1;
    setupOverlay.style.display = "none";
    startRound();
}

// --- 2. ラウンド開始 ---
function startRound() {
    currentLevel = 0;
    currentIndex = 0;
    isParentTurn = false;
    playerBets = {}; 
    
    pyramidBoard.innerHTML = "";
    resultRow.innerHTML = "";
    nextRoundBtn.style.display = "none";
    
    bettingQueue = [];
    players.forEach((_, index) => {
        if (index !== parentIndex) bettingQueue.push(index);
    });

    updatePlayerListUI();
    generateBoard(); // ここでカテゴリに基づいた質問を生成

    const parentName = players[parentIndex].name;
    gameStatus.textContent = `第${roundCount}回戦 - 親: ${parentName}`;
    
    startBettingPhase();
}

// --- 3. ベットフェーズ ---
function startBettingPhase() {
    if (bettingQueue.length > 0) {
        currentBetterIndex = bettingQueue.shift();
        const p = players[currentBetterIndex];
        
        bettingControls.style.display = "block";
        currentBetterNameUI.textContent = `${p.name}さんの予想`;
        instructionText.textContent = `${p.name}さん、賭け金を入力してゴールを選んでください。`;
        betAmountInput.value = 10;
        
        updatePlayerListUI(); 
    } else {
        bettingControls.style.display = "none";
        startParentTurn();
    }
}

// --- 4. 子のベット処理 ---
function handleChildBet(goalIndex) {
    if (isParentTurn) return;
    if (currentBetterIndex === -1) return;

    const amount = parseInt(betAmountInput.value);
    const p = players[currentBetterIndex];

    if (isNaN(amount) || amount <= 0) { alert("正しい賭け金を入力してください"); return; }
    if (p.chips < amount) { alert("チップが足りません！"); return; }

    if(!confirm(`${p.name}さんの予想\n場所: x${multipliers[goalIndex]}\n賭け金: ${amount}\n\nこれで確定しますか？`)) {
        return;
    }

    p.chips -= amount;
    p.history.push({ 
        round: roundCount, 
        reason: "予想", 
        diff: -amount, 
        balance: p.chips 
    });

    playerBets[currentBetterIndex] = { goalIndex: goalIndex, amount: amount };

    addBetMarker(goalIndex, p.name, amount);

    currentBetterIndex = -1;
    updatePlayerListUI();
    startBettingPhase();
}

// --- 5. UIヘルパー ---
function addBetMarker(goalIndex, name, amount) {
    const goalCard = document.querySelector(`.result-card[data-index="${goalIndex}"]`);
    const container = goalCard.querySelector(".bet-markers-container");
    const marker = document.createElement("div");
    marker.className = "bet-marker";
    marker.textContent = `${name}:${amount}`;
    container.appendChild(marker);
}

function updatePlayerListUI() {
    playerListUI.innerHTML = "";
    players.forEach((p, index) => {
        const div = document.createElement("div");
        div.className = "player-item";
        if (index === parentIndex) div.classList.add("is-parent");
        if (index === currentBetterIndex) div.classList.add("active-better");
        
        div.innerHTML = `
            <div class="player-info">
                <span>${p.name} ${index === parentIndex ? '(親)' : ''}</span>
            </div>
            <div class="player-info">
                <strong>${p.chips}</strong>
                <button class="history-btn" onclick="showHistory(${index})">履歴</button>
            </div>
        `;
        playerListUI.appendChild(div);
    });
}

function showHistory(playerIndex) {
    const p = players[playerIndex];
    historyTitle.textContent = `${p.name}さんの履歴`;
    historyListBody.innerHTML = "";

    [...p.history].reverse().forEach(h => {
        const row = document.createElement("tr");
        const diffClass = h.diff >= 0 ? "diff-plus" : "diff-minus";
        const diffText = h.diff > 0 ? `+${h.diff}` : h.diff; 
        
        row.innerHTML = `
            <td>${h.round}</td>
            <td>${h.reason}</td>
            <td class="${diffClass}">${diffText}</td>
            <td>${h.balance}</td>
        `;
        historyListBody.appendChild(row);
    });

    historyOverlay.style.display = "flex";
}

// --- 6. ボード生成（カテゴリ対応版） ---
function generateBoard() {
    if (typeof questionCategories === 'undefined') {
        alert("質問データ(dottiboy_question.js)が見つかりません"); return;
    }

    // 選択されたカテゴリに応じて質問リストを作成
    let targetQuestions = [];

    if (selectedCategoryKey === "all") {
        // 全てのカテゴリの質問を結合
        for (const key in questionCategories) {
            targetQuestions = targetQuestions.concat(questionCategories[key].questions);
        }
    } else {
        // 特定のカテゴリのみ
        if (questionCategories[selectedCategoryKey]) {
            targetQuestions = questionCategories[selectedCategoryKey].questions;
        } else {
            // エラー時はAllにする
             for (const key in questionCategories) {
                targetQuestions = targetQuestions.concat(questionCategories[key].questions);
            }
        }
    }

    if (targetQuestions.length < 15) {
        alert("質問数が足りません（最低15問必要です）");
        return;
    }

    // シャッフル
    const shuffledQuestions = [...targetQuestions].sort(() => 0.5 - Math.random());

    let qCounter = 0;
    for (let row = 0; row < 5; row++) {
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("board-row");
        for (let col = 0; col <= row; col++) {
            const card = document.createElement("div");
            card.classList.add("card");
            card.dataset.row = row;
            card.dataset.col = col;
            card.innerHTML = `
                <span>${shuffledQuestions[qCounter]}</span>
                <div class="decision-btns">
                    <button class="btn-yes" onclick="handleParentChoice(event, true)">YES</button>
                    <button class="btn-no" onclick="handleParentChoice(event, false)">NO</button>
                </div>
            `;
            rowDiv.appendChild(card);
            qCounter++;
        }
        pyramidBoard.appendChild(rowDiv);
    }

    for (let i = 0; i < 6; i++) {
        const rCard = document.createElement("div");
        rCard.classList.add("result-card");
        rCard.dataset.index = i;
        rCard.innerHTML = `
            <div>GOAL</div><div><strong>x${multipliers[i]}</strong></div>
            <div class="bet-markers-container"></div>
        `;
        rCard.addEventListener("click", () => handleChildBet(i));
        resultRow.appendChild(rCard);
    }
}

// --- 7. 親のターン ---
function startParentTurn() {
    isParentTurn = true;
    gameStatus.textContent = `第${roundCount}回戦 - 親（${players[parentIndex].name}）のターン！`;
    instructionText.textContent = "親は今の気持ちで YES / NO を選んで進んでください。";
    activateCard(0, 0);
}

function handleParentChoice(event, isYes) {
    event.stopPropagation();
    const currentCard = document.querySelector(`.card[data-row="${currentLevel}"][data-col="${currentIndex}"]`);
    currentCard.classList.remove("active");
    currentCard.classList.add("passed");

    if (!isYes) currentIndex++;
    currentLevel++;

    if (currentLevel < 5) {
        activateCard(currentLevel, currentIndex);
    } else {
        finishRound();
    }
}

function activateCard(row, col) {
    const target = document.querySelector(`.card[data-row="${row}"][data-col="${col}"]`);
    if (target) target.classList.add("active");
}

// --- 8. 結果判定 ---
function finishRound() {
    gameStatus.textContent = "結果発表！";
    const finalIndex = currentIndex;
    
    document.querySelectorAll(".result-card")[finalIndex].classList.add("winner");

    let resultMessage = "結果: ";
    let hasWinner = false;

    for (const [pIdx, betData] of Object.entries(playerBets)) {
        const pIndex = parseInt(pIdx);
        const p = players[pIndex];
        
        if (betData.goalIndex === finalIndex) {
            const winAmount = betData.amount * multipliers[finalIndex];
            p.chips += winAmount; 
            
            p.history.push({ 
                round: roundCount, 
                reason: "的中", 
                diff: winAmount, 
                balance: p.chips 
            });

            resultMessage += `[${p.name}: +${winAmount}] `;
            hasWinner = true;
        }
    }

    if (!hasWinner) {
        instructionText.textContent = "残念、的中者なし...";
    } else {
        instructionText.textContent = resultMessage;
    }

    updatePlayerListUI();
    
    roundCount++; 
    parentIndex = (parentIndex + 1) % players.length;
    nextRoundBtn.style.display = "inline-block";
    nextRoundBtn.textContent = `次は ${players[parentIndex].name} さんが親です`;
}