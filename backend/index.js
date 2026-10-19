const BOARD_SIZE = 15;
const FLEET_SIZES = [5, 4, 3, 3, 2, 2, 2];
const PLAYERS = ["sonni", "felix"];
const YATZY_CATEGORIES = [
  "ones", "twos", "threes", "fours", "fives", "sixes",
  "threeKind", "fourKind", "fullHouse", "smallStraight",
  "largeStraight", "chance", "yatzy",
];
const FIND_MATCH_SHAPES = ["circle", "square", "triangle", "diamond", "star"];
const FIND_MATCH_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#b388ff", "#ff8fab"];
const FIND_MATCH_ITEMS_PER_CARD = 9;
const FIND_MATCH_TARGET_SCORE = 10;
const MEMORY_ANIMALS = ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵", "🐷", "🐮", "🐔"];
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getPositions(anchor, length, horizontal) {
  const row = Math.floor(anchor / BOARD_SIZE);
  const column = anchor % BOARD_SIZE;
  if (horizontal && column + length > BOARD_SIZE) return null;
  if (!horizontal && row + length > BOARD_SIZE) return null;
  return Array.from({ length }, (_, offset) =>
    (row + (horizontal ? 0 : offset)) * BOARD_SIZE +
    column + (horizontal ? offset : 0));
}

function makeFleet() {
  const grid = Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  const ships = [];

  for (const length of FLEET_SIZES) {
    const candidates = [];
    for (const horizontal of [true, false]) {
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let column = 0; column < BOARD_SIZE; column += 1) {
          const positions = getPositions(row * BOARD_SIZE + column, length, horizontal);
          if (!positions) continue;
          const shipCells = new Set(positions);
          const clear = positions.every((position) => {
            const shipRow = Math.floor(position / BOARD_SIZE);
            const shipColumn = position % BOARD_SIZE;
            for (let neighborRow = Math.max(0, shipRow - 1); neighborRow <= Math.min(BOARD_SIZE - 1, shipRow + 1); neighborRow += 1) {
              for (let neighborColumn = Math.max(0, shipColumn - 1); neighborColumn <= Math.min(BOARD_SIZE - 1, shipColumn + 1); neighborColumn += 1) {
                const neighbor = neighborRow * BOARD_SIZE + neighborColumn;
                if (grid[neighbor] !== -1 && !shipCells.has(neighbor)) return false;
              }
            }
            return true;
          });
          if (clear) candidates.push({ positions, horizontal });
        }
      }
    }

    if (candidates.length === 0) throw new Error("Could not place the complete fleet.");
    const { positions, horizontal } = candidates[Math.floor(Math.random() * candidates.length)];
    const shipId = ships.length;
    positions.forEach((position) => { grid[position] = shipId; });
    ships.push({ positions, horizontal, hits: 0 });
  }

  return { grid, ships };
}

function createInitialState() {
  return {
    wins: { sonni: 0, felix: 0 },
    ticTacToe: {
      board: Array(9).fill(null),
      currentPlayer: "sonni",
      startingPlayer: "sonni",
      nextStarter: "sonni",
      winner: null,
      draw: false,
    },
    battleship: {
      players: {
        sonni: { fleet: makeFleet(), shots: Array(BOARD_SIZE * BOARD_SIZE).fill(null), ready: false },
        felix: { fleet: makeFleet(), shots: Array(BOARD_SIZE * BOARD_SIZE).fill(null), ready: false },
      },
      started: false,
      currentPlayer: "sonni",
      winner: null,
    },
    yatzy: createYatzyGame(),
    "find-match": createFindMatchGame(),
    memory: createMemoryGame(),
  };
}

function createMemoryGame() {
  return {
    cards: [...MEMORY_ANIMALS, ...MEMORY_ANIMALS]
      .map((animal) => ({ animal, matched: false }))
      .sort(() => Math.random() - 0.5),
    revealed: [],
    currentPlayer: "sonni",
    scores: { sonni: 0, felix: 0 },
    winner: null,
    draw: false,
    mismatchUntil: null,
  };
}

function createFindMatchItems(matchKey, otherItems, matchSize) {
  const items = [
    { ...matchKey, size: matchSize },
    ...otherItems.map(({ shape, color }) => ({
      shape,
      color,
      size: 24 + Math.floor(Math.random() * 33),
    })),
  ];
  return items.sort(() => Math.random() - 0.5);
}

function createFindMatchRound(round) {
  const matchKey = {
    shape: FIND_MATCH_SHAPES[Math.floor(Math.random() * FIND_MATCH_SHAPES.length)],
    color: FIND_MATCH_COLORS[Math.floor(Math.random() * FIND_MATCH_COLORS.length)],
  };
  const otherItems = [];
  for (const shape of FIND_MATCH_SHAPES) {
    for (const color of FIND_MATCH_COLORS) {
      if (shape !== matchKey.shape || color !== matchKey.color) otherItems.push({ shape, color });
    }
  }
  otherItems.sort(() => Math.random() - 0.5);
  const firstMatchSize = 24 + Math.floor(Math.random() * 33);
  let secondMatchSize = 24 + Math.floor(Math.random() * 33);
  if (secondMatchSize === firstMatchSize) {
    secondMatchSize = secondMatchSize === 56 ? 24 : secondMatchSize + 1;
  }
  const left = createFindMatchItems(matchKey, otherItems.slice(0, FIND_MATCH_ITEMS_PER_CARD - 1), firstMatchSize);
  const right = createFindMatchItems(
    matchKey,
    otherItems.slice(FIND_MATCH_ITEMS_PER_CARD - 1, (FIND_MATCH_ITEMS_PER_CARD - 1) * 2),
    secondMatchSize,
  );
  return { round, matchKey, cards: [left, right], lastScorer: null };
}

function createFindMatchGame(round = 1, scores = { sonni: 0, felix: 0 }) {
  return {
    ...createFindMatchRound(round),
    scores,
    winner: null,
  };
}

function createYatzyGame() {
  const emptyScores = () => Object.fromEntries(YATZY_CATEGORIES.map((category) => [category, null]));
  return {
    dice: [1, 1, 1, 1, 1],
    rollCount: 0,
    currentPlayer: "sonni",
    scores: { sonni: emptyScores(), felix: emptyScores() },
    winner: null,
    draw: false,
  };
}

function scoreYatzyCategory(category, dice) {
  const counts = Array(7).fill(0);
  dice.forEach((die) => { counts[die] += 1; });
  const sum = dice.reduce((total, die) => total + die, 0);

  if (category === "ones" || category === "twos" || category === "threes" ||
      category === "fours" || category === "fives" || category === "sixes") {
    const face = YATZY_CATEGORIES.indexOf(category) + 1;
    return counts[face] * face;
  }
  if (category === "threeKind") return counts.some((count) => count >= 3) ? sum : 0;
  if (category === "fourKind") return counts.some((count) => count >= 4) ? sum : 0;
  if (category === "fullHouse") {
    return counts.includes(3) && counts.includes(2) ? 25 : 0;
  }
  if (category === "smallStraight") {
    return [1, 2, 3, 4, 5].every((face) => counts[face] > 0) ? 30 : 0;
  }
  if (category === "largeStraight") {
    return [2, 3, 4, 5, 6].every((face) => counts[face] > 0) ? 40 : 0;
  }
  if (category === "chance") return sum;
  if (category === "yatzy") return counts.includes(5) ? 50 : 0;
  return null;
}

function getYatzyTotal(scores) {
  const upperTotal = ["ones", "twos", "threes", "fours", "fives", "sixes"]
    .reduce((total, category) => total + (scores[category] || 0), 0);
  const lowerTotal = YATZY_CATEGORIES.slice(6)
    .reduce((total, category) => total + (scores[category] || 0), 0);
  return upperTotal + (upperTotal >= 63 ? 35 : 0) + lowerTotal;
}

function validateFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET_SIZES.length) return null;
  const grid = Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  const normalizedShips = [];

  for (const [shipId, ship] of ships.entries()) {
    if (
      !ship ||
      typeof ship.horizontal !== "boolean" ||
      !Array.isArray(ship.positions) ||
      ship.positions.length !== FLEET_SIZES[shipId] ||
      !ship.positions.every((position) => Number.isInteger(position) && position >= 0 && position < grid.length)
    ) {
      return null;
    }

    const anchor = ship.positions[0];
    const expected = getPositions(anchor, FLEET_SIZES[shipId], ship.horizontal);
    if (!expected || expected.some((position, index) => position !== ship.positions[index])) return null;

    const ownPositions = new Set(expected);
    for (const position of expected) {
      const row = Math.floor(position / BOARD_SIZE);
      const column = position % BOARD_SIZE;
      for (let neighborRow = Math.max(0, row - 1); neighborRow <= Math.min(BOARD_SIZE - 1, row + 1); neighborRow += 1) {
        for (let neighborColumn = Math.max(0, column - 1); neighborColumn <= Math.min(BOARD_SIZE - 1, column + 1); neighborColumn += 1) {
          const neighbor = neighborRow * BOARD_SIZE + neighborColumn;
          if (grid[neighbor] !== -1 && !ownPositions.has(neighbor)) return null;
        }
      }
    }

    expected.forEach((position) => { grid[position] = shipId; });
    normalizedShips.push({ positions: expected, horizontal: ship.horizontal, hits: 0 });
  }

  return { grid, ships: normalizedShips };
}

function allShipsSunk(fleet) {
  return fleet.ships.every((ship) => ship.hits === ship.positions.length);
}

function makeView(state, account, online) {
  if (state.game === "tic-tac-toe") {
    const game = state.ticTacToe;
    return {
      type: "state",
      game: "tic-tac-toe",
      account,
      symbol: account === "sonni" ? "X" : "O",
      board: game.board,
      currentPlayer: game.currentPlayer,
      winner: game.winner,
      draw: game.draw,
      opponentOnline: online.has(account === "sonni" ? "felix" : "sonni"),
    };
  }

  if (state.game === "yatzy") {
    const game = state.yatzy;
    return {
      type: "state",
      game: "yatzy",
      account,
      dice: game.dice,
      rollCount: game.rollCount,
      currentPlayer: game.currentPlayer,
      scores: game.scores,
      totals: {
        sonni: getYatzyTotal(game.scores.sonni),
        felix: getYatzyTotal(game.scores.felix),
      },
      winner: game.winner,
      draw: game.draw,
      opponentOnline: online.has(account === "sonni" ? "felix" : "sonni"),
    };
  }

  if (state.game === "find-match") {
    const game = state["find-match"];
    return {
      type: "state",
      game: "find-match",
      account,
      round: game.round,
      cards: game.cards,
      scores: game.scores,
      lastScorer: game.lastScorer,
      winner: game.winner,
      targetScore: FIND_MATCH_TARGET_SCORE,
      opponentOnline: online.has(account === "sonni" ? "felix" : "sonni"),
    };
  }

  if (state.game === "memory") {
    const game = state.memory;
    return {
      type: "state",
      game: "memory",
      account,
      cards: game.cards,
      revealed: game.revealed,
      currentPlayer: game.currentPlayer,
      scores: game.scores,
      winner: game.winner,
      draw: game.draw,
      mismatchPending: Boolean(game.mismatchUntil),
      opponentOnline: online.has(account === "sonni" ? "felix" : "sonni"),
    };
  }

  const game = state.battleship;
  const opponent = account === "sonni" ? "felix" : "sonni";
  const player = game.players[account];
  const opposingPlayer = game.players[opponent];
  return {
    type: "state",
    game: "battleship",
    account,
    fleet: player.fleet,
    shotsOnEnemy: player.shots,
    shotsOnMe: opposingPlayer.shots,
    sunkOnEnemy: opposingPlayer.fleet.ships
      .filter((ship) => ship.hits === ship.positions.length)
      .flatMap((ship) => ship.positions),
    ready: player.ready,
    opponentReady: opposingPlayer.ready,
    started: game.started,
    currentPlayer: game.currentPlayer,
    winner: game.winner,
    opponentOnline: online.has(opponent),
  };
}

export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = null;
    this.roomRegistered = false;
    this.statePromise = ctx.blockConcurrencyWhile(async () => {
      this.state = await ctx.storage.get("state") || createInitialState();
      this.roomRegistered = await ctx.storage.get("roomRegistered") || false;
      this.state.wins ||= { sonni: 0, felix: 0 };
      this.state.ticTacToe.startingPlayer ||= this.state.ticTacToe.currentPlayer || "sonni";
      this.state.ticTacToe.nextStarter ||= this.state.ticTacToe.startingPlayer;
      this.state.yatzy ||= createYatzyGame();
      this.state["find-match"] ||= createFindMatchGame();
      this.state.memory ||= createMemoryGame();
      await ctx.storage.put("state", this.state);
    });
  }

  async fetch(request) {
    await this.statePromise;
    const account = request.headers.get("X-Spielportal-Player");
    const path = new URL(request.url).pathname.split("/").filter(Boolean);
    const game = path.find((part) =>
      part === "tic-tac-toe" || part === "battleship" || part === "yatzy" || part === "find-match" || part === "memory");
    if (!PLAYERS.includes(account)) return new Response("Unauthorized", { status: 401 });
    if (!["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"].includes(game)) return new Response("Unknown game", { status: 404 });

    if (path.at(-1) === "register") {
      if (request.method !== "POST" || account !== "sonni") return new Response("Forbidden", { status: 403 });
      this.roomRegistered = true;
      await this.ctx.storage.put("roomRegistered", true);
      return Response.json({ registered: true });
    }
    if (path.at(-1) === "status") {
      return this.roomRegistered
        ? Response.json({ registered: true })
        : new Response("Room not found", { status: 404 });
    }

    if (path.at(-1) === "scoreboard") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return Response.json(this.state.wins, { headers: { "Cache-Control": "no-store" } });
    }
    if (!this.roomRegistered) return new Response("Room not found", { status: 404 });

    if (request.headers.get("Origin") !== new URL(request.url).origin) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (this.getOnlinePlayers().has(account)) return new Response("This player is already connected", { status: 409 });

    this.state.game = game;
    await this.ctx.storage.put("state", this.state);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ account, game });
    this.ctx.acceptWebSocket(server, [account]);
    server.send(JSON.stringify(makeView(this.state, account, this.getOnlinePlayers())));
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    await this.statePromise;
    const attachment = socket.deserializeAttachment();
    if (!attachment || !PLAYERS.includes(attachment.account) || attachment.game !== this.state.game) {
      socket.close(1008, "Invalid player session");
      return;
    }

    let action;
    try {
      action = JSON.parse(message);
    } catch {
      this.sendError(socket, "Ungültige Spielaktion.");
      return;
    }

    if (!action || typeof action.type !== "string") {
      this.sendError(socket, "Ungültige Spielaktion.");
      return;
    }

    const previousWinner = this.getWinner();
    if (action.type === "restart") {
      if (this.state.game === "tic-tac-toe") {
        const startingPlayer = this.state.ticTacToe.nextStarter;
        this.state.ticTacToe = {
          board: Array(9).fill(null),
          currentPlayer: startingPlayer,
          startingPlayer,
          nextStarter: startingPlayer,
          winner: null,
          draw: false,
        };
      } else if (this.state.game === "battleship") {
        this.state.battleship = createInitialState().battleship;
      } else if (this.state.game === "find-match") {
        this.state["find-match"] = createFindMatchGame();
      } else if (this.state.game === "memory") {
        this.state.memory = createMemoryGame();
        await this.ctx.storage.deleteAlarm();
      } else {
        this.state.yatzy = createYatzyGame();
      }
    } else if (this.state.game === "tic-tac-toe") {
      this.applyTicTacToeAction(attachment.account, action, socket);
    } else if (this.state.game === "yatzy") {
      this.applyYatzyAction(attachment.account, action, socket);
    } else if (this.state.game === "find-match") {
      this.applyFindMatchAction(attachment.account, action, socket);
    } else if (this.state.game === "memory") {
      this.applyMemoryAction(attachment.account, action, socket);
    } else {
      this.applyBattleshipAction(attachment.account, action, socket);
    }

    if (this.state.game === "memory" && this.state.memory.mismatchUntil) {
      await this.ctx.storage.setAlarm(this.state.memory.mismatchUntil);
    }
    const winner = this.getWinner();
    if (!previousWinner && winner) {
      this.state.wins[winner] += 1;
    }
    await this.ctx.storage.put("state", this.state);
    this.broadcast();
  }

  getWinner() {
    if (this.state.game === "tic-tac-toe") return this.state.ticTacToe.winner;
    return this.state[this.state.game].winner;
  }

  async alarm() {
    await this.statePromise;
    const game = this.state.memory;
    if (this.state.game !== "memory" || !game.mismatchUntil) return;
    if (game.mismatchUntil > Date.now()) {
      await this.ctx.storage.setAlarm(game.mismatchUntil);
      return;
    }
    game.revealed = [];
    game.currentPlayer = game.currentPlayer === "sonni" ? "felix" : "sonni";
    game.mismatchUntil = null;
    await this.ctx.storage.put("state", this.state);
    this.broadcast();
  }

  applyMemoryAction(account, action, socket) {
    const game = this.state.memory;
    if (game.winner) {
      this.sendError(socket, "Das Spiel ist beendet.");
      return;
    }
    if (game.mismatchUntil) {
      this.sendError(socket, "Die Karten werden gerade umgedreht.");
      return;
    }
    if (game.currentPlayer !== account) {
      this.sendError(socket, "Der andere Spieler ist dran.");
      return;
    }
    if (action.type !== "flip" || !Number.isInteger(action.index) ||
        action.index < 0 || action.index >= game.cards.length ||
        game.cards[action.index].matched || game.revealed.includes(action.index)) {
      this.sendError(socket, "Diese Karte ist nicht verfügbar.");
      return;
    }

    game.revealed.push(action.index);
    if (game.revealed.length !== 2) return;

    const [firstIndex, secondIndex] = game.revealed;
    if (game.cards[firstIndex].animal === game.cards[secondIndex].animal) {
      game.cards[firstIndex].matched = true;
      game.cards[secondIndex].matched = true;
      game.revealed = [];
      game.scores[account] += 1;
      if (game.cards.every((card) => card.matched)) {
        game.winner = game.scores.sonni === game.scores.felix
          ? null
          : game.scores.sonni > game.scores.felix ? "sonni" : "felix";
        game.draw = !game.winner;
      }
    } else {
      game.mismatchUntil = Date.now() + 1000;
    }
  }

  applyFindMatchAction(account, action, socket) {
    const game = this.state["find-match"];
    if (action.type !== "claim" || game.winner) {
      this.sendError(socket, game.winner ? "Das Spiel ist beendet." : "Ungültige Spielaktion.");
      return;
    }
    if (action.round !== game.round || !Number.isInteger(action.card) ||
        (action.card !== 0 && action.card !== 1) || !Number.isInteger(action.index) ||
        action.index < 0 || action.index >= FIND_MATCH_ITEMS_PER_CARD) {
      this.sendError(socket, "Diese Karte ist nicht mehr verfügbar.");
      return;
    }
    const sideAccount = action.card === 0 ? "felix" : "sonni";
    if (account !== sideAccount) {
      this.sendError(socket, `Das ist die Seite von ${sideAccount === "sonni" ? "Sonni" : "Felix"}.`);
      return;
    }

    const item = game.cards[action.card][action.index];
    if (item.shape !== game.matchKey.shape || item.color !== game.matchKey.color) {
      this.sendError(socket, "Das ist nicht das passende Item.");
      return;
    }

    game.scores[sideAccount] += 1;
    game.lastScorer = sideAccount;
    if (game.scores[sideAccount] >= FIND_MATCH_TARGET_SCORE) {
      game.winner = sideAccount;
      return;
    }

    this.state["find-match"] = createFindMatchRound(game.round + 1);
    this.state["find-match"].scores = game.scores;
    this.state["find-match"].lastScorer = sideAccount;
  }

  applyYatzyAction(account, action, socket) {
    const game = this.state.yatzy;
    if (game.winner || game.draw) {
      this.sendError(socket, "Das Spiel ist beendet.");
      return;
    }
    if (game.currentPlayer !== account) {
      this.sendError(socket, "Der andere Spieler ist dran.");
      return;
    }

    if (action.type === "roll") {
      if (game.rollCount >= 3) {
        this.sendError(socket, "Du hast bereits dreimal gewürfelt.");
        return;
      }
      if (!Array.isArray(action.held) || action.held.length !== 5 ||
          !action.held.every((held) => typeof held === "boolean")) {
        this.sendError(socket, "Ungültige Würfelauswahl.");
        return;
      }
      game.dice = game.dice.map((die, index) =>
        action.held[index] && game.rollCount > 0 ? die : Math.floor(Math.random() * 6) + 1);
      game.rollCount += 1;
      return;
    }

    if (action.type !== "score" || !YATZY_CATEGORIES.includes(action.category)) {
      this.sendError(socket, "Ungültige Spielaktion.");
      return;
    }
    if (game.rollCount === 0) {
      this.sendError(socket, "Würfle zuerst.");
      return;
    }
    if (game.scores[account][action.category] !== null) {
      this.sendError(socket, "Diese Kategorie wurde bereits gewertet.");
      return;
    }

    game.scores[account][action.category] = scoreYatzyCategory(action.category, game.dice);
    const allScored = YATZY_CATEGORIES.every((category) =>
      game.scores.sonni[category] !== null && game.scores.felix[category] !== null);
    if (allScored) {
      const sonniTotal = getYatzyTotal(game.scores.sonni);
      const felixTotal = getYatzyTotal(game.scores.felix);
      game.winner = sonniTotal === felixTotal ? null : sonniTotal > felixTotal ? "sonni" : "felix";
      game.draw = sonniTotal === felixTotal;
    } else {
      game.currentPlayer = account === "sonni" ? "felix" : "sonni";
      game.rollCount = 0;
      game.dice = [1, 1, 1, 1, 1];
    }
  }

  applyTicTacToeAction(account, action, socket) {
    const game = this.state.ticTacToe;
    if (action.type !== "move") {
      this.sendError(socket, "Unbekannte Aktion.");
      return;
    }
    if (game.winner || game.draw) {
      this.sendError(socket, "Das Spiel ist beendet.");
      return;
    }
    if (game.currentPlayer !== account) {
      this.sendError(socket, "Der andere Spieler ist dran.");
      return;
    }
    if (!Number.isInteger(action.position) || action.position < 0 || action.position >= 9 || game.board[action.position] !== null) {
      this.sendError(socket, "Dieses Feld ist nicht verfügbar.");
      return;
    }

    game.board[action.position] = account === "sonni" ? "X" : "O";
    const winningLine = WINNING_LINES.find((line) =>
      line.every((position) => game.board[position] === game.board[action.position]));
    if (winningLine) {
      game.winner = account;
    } else if (game.board.every(Boolean)) {
      game.draw = true;
    } else {
      game.currentPlayer = account === "sonni" ? "felix" : "sonni";
    }

    if (game.winner || game.draw) {
      game.nextStarter = game.startingPlayer === "sonni" ? "felix" : "sonni";
    }
  }

  applyBattleshipAction(account, action, socket) {
    const game = this.state.battleship;
    const player = game.players[account];
    const opponent = game.players[account === "sonni" ? "felix" : "sonni"];

    if (action.type === "place") {
      if (game.started) {
        this.sendError(socket, "Die Flotte ist bereits gestartet.");
        return;
      }
      const fleet = validateFleet(action.ships);
      if (!fleet) {
        this.sendError(socket, "Die Schiffsaufstellung ist ungültig.");
        return;
      }
      player.fleet = fleet;
      player.ready = false;
      return;
    }

    if (action.type === "ready") {
      if (game.started) {
        this.sendError(socket, "Das Spiel läuft bereits.");
        return;
      }
      player.ready = true;
      if (game.players.sonni.ready && game.players.felix.ready) {
        game.started = true;
        game.currentPlayer = "sonni";
      }
      return;
    }

    if (action.type !== "shoot") {
      this.sendError(socket, "Unbekannte Aktion.");
      return;
    }
    if (!game.started) {
      this.sendError(socket, "Beide Spieler müssen ihre Flotte bereitstellen.");
      return;
    }
    if (game.winner) {
      this.sendError(socket, "Das Spiel ist beendet.");
      return;
    }
    if (game.currentPlayer !== account) {
      this.sendError(socket, "Der andere Spieler ist dran.");
      return;
    }
    if (!Number.isInteger(action.position) || action.position < 0 || action.position >= BOARD_SIZE * BOARD_SIZE || player.shots[action.position] !== null) {
      this.sendError(socket, "Dieses Feld wurde bereits beschossen oder ist ungültig.");
      return;
    }

    const shipId = opponent.fleet.grid[action.position];
    player.shots[action.position] = shipId === -1 ? "miss" : "hit";
    if (shipId !== -1) opponent.fleet.ships[shipId].hits += 1;
    if (allShipsSunk(opponent.fleet)) {
      game.winner = account;
    } else {
      game.currentPlayer = account === "sonni" ? "felix" : "sonni";
    }
  }

  webSocketClose() {
    this.broadcast();
  }

  webSocketError() {
    this.broadcast();
  }

  getOnlinePlayers() {
    return new Set(this.ctx.getWebSockets().map((socket) => {
      const attachment = socket.deserializeAttachment();
      return attachment && attachment.account;
    }).filter(Boolean));
  }

  sendError(socket, message) {
    socket.send(JSON.stringify({ type: "error", message }));
  }

  broadcast() {
    const online = this.getOnlinePlayers();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (!attachment || attachment.game !== this.state.game) continue;
      socket.send(JSON.stringify(makeView(this.state, attachment.account, online)));
    }
  }
}

export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
