import { db, Game } from "..";

const k = 30
const getp1 = (elo: number, enemyTeamElo: number) => 1 / (1 + 10 ** ((elo - enemyTeamElo) / 400));

const getAvgElo = (playerListWithElo: { elo: number }[]): number => {
  if (playerListWithElo.length == 0) {
    throw("There are no players with elo in one of the teams.")
  }
  return playerListWithElo
  .map(p => p.elo)
  .reduce((a,b) => a+b, 0)/playerListWithElo.length
}

export const changeElo = async (game: Game, winnerTeamId: TeamID) => {
  const holdPlayersWithElo = []
  for (const holdPlayer of game.holdPlayers) {
    const result = await db.get("SELECT elo FROM players WHERE auth=?", [
        holdPlayer.auth,
    ]);
    holdPlayersWithElo.push({...holdPlayer, elo: result.elo })
  }
  const loserTeamId = winnerTeamId == 1 ? 2 : 1
  const winners = holdPlayersWithElo.filter(p => p.team == winnerTeamId)
  const losers = holdPlayersWithElo.filter(p => p.team == loserTeamId)
  const winnerTeamElo = getAvgElo(winners)
  const loserTeamElo = getAvgElo(losers)
  const changeLosers = losers.map(p => {
    const p1 = getp1(p.elo, winnerTeamElo)
    const change = -Math.round((k * (1 - p1)))
    if (isNaN(change)) { throw("Change is not a number.") }
    return { id: p.id, auth: p.auth, change }
  })
  const changeWinners = winners.map(p => {
    const p1 = getp1(p.elo, loserTeamElo)
    const change = Math.round((k * p1))
    if (isNaN(change)) { throw("Change is not a number.")}
    return { id: p.id, auth: p.auth, change }
  })
  const changeList = [...changeWinners, ...changeLosers]
  for (const changeTuple of changeList) {
    await db.run(`UPDATE players SET elo=elo+? WHERE auth=?`, [changeTuple.change, changeTuple.auth]);
  }
  return changeList
}
