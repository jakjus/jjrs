let players = []

class PlayerAugmented {
  constructor(id) {
    this.id = id
    this.elo = 1200;
  }
}
class Game {
  constructor() {
    this.currentPlayers = JSON.parse(JSON.stringify(players)); // used to keep track on leavers in case they reconnect with red card or injury
  }
}

const a = new PlayerAugmented(0)
const b = new PlayerAugmented(1)
players.push(a)
players.push(b)

let game = new Game()
console.log(game)
console.log(players)
const found = players.find((pp) => pp.id == 0);
found.elo = 1300
console.log(game)
console.log(players)
