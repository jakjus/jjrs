import { room, players, PlayerAugmented } from "..";
import { sendMessage } from "./message";
import { game, Game } from "..";
import { sleep } from "./utils";
import * as fs from 'fs';
import { toAug } from "..";
import { teamSize } from "./settings";
import { calculateChanges, execChanges } from "hax-standard-elo";
import { changeEloOfPlayer, getOrCreatePlayer } from "./db";

const maxTeamSize = process.env.DEBUG ? 2 : teamSize
let isRunning: boolean = false;
let isRanked: boolean = false;
export let duringDraft: boolean = false;

const balanceTeams = () => {
	if (duringDraft || isRanked) {
		return
	}
	// To be used only during unranked
	if (red().length > blue().length+1) {
		room.setPlayerTeam(red()[0].id, 2)
	} else if (red().length+1 < blue().length) {
		room.setPlayerTeam(blue()[0].id, 1)
	}
}

export const handlePlayerLeaveOrAFK = async (p: PlayerAugmented) => {
		await sleep(100)
		if (!duringDraft && !isRanked) {
			balanceTeams()
		}
		if (isRanked) {
			if ([...red(), ...blue()].length <= 2) {
				isRanked = false
				sendMessage('Only 2 players left. Cancelling ranked game.')
			}
		}

}

const handleWin = async (game: Game) => {
	const getEloOfPlayer = async (playerId: number) => {
		const p = game.currentPlayers.find(p => p.id == playerId)
		if (!p) { console.log('Error finding players for ELO calculation with ID ', playerId); return 1200 }
		const res = await getOrCreatePlayer(p)
		return res.elo
	}

	const changes = await calculateChanges(room, getEloOfPlayer, game.currentPlayers)
	console.log('changes', changes)
	changes.forEach(co => {
		const p = room.getPlayer(co.playerId)
		if (p) {
			sendMessage(`Your ELO: ${toAug(p).elo} → ${toAug(p).elo+co.change} (${co.change > 0 ? '+': ''}${co.change})`, p)
		}
	})

	await execChanges(changes, getEloOfPlayer, changeEloOfPlayer)
	changes.forEach(co => {
		if (players.map(p => p.id).includes(co.playerId)) {
			toAug(room.getPlayer(co.playerId)).elo += co.change  // change elo on server just for showing in chat. when running two instances of the server, this may be not accurate, although it is always accurate in DB (because the changes and calculations are always based on DB data, not on in game elo. false elo will be corrected on reconnect.)
		}
	})
}
const red = () => room.getPlayerList().filter(p => p.team == 1)
const blue = () => room.getPlayerList().filter(p => p.team == 2)
const spec = () => room.getPlayerList().filter(p => p.team == 0)
const both = () => room.getPlayerList().filter(p => p.team == 1 || p.team == 2)
const ready = () => room.getPlayerList().filter(p => !toAug(p).afk)

export const addToGame = (room: RoomObject, p: PlayerObject) => {
	if (game && isRanked && [...red(), ...blue()].length <= maxTeamSize*2) {
		return
	}
	if (game && (toAug(p).cardsAnnounced >= 2 || toAug(p).foulsMeter >= 2)) {
		return
	}
	if (duringDraft) {
		return
	}
	if (red().length > blue().length) {
		room.setPlayerTeam(p.id, 2)
	} else {
		room.setPlayerTeam(p.id, 1)
	}
}

const initChooser = (room: RoomObject) => {

	const refill = () => {
		const specs = spec().filter(p => !toAug(p).afk)
		for (let i=0; i<specs.length; i++) {
			const toTeam = i % 2 == 0 ? 1 : 2
			room.setPlayerTeam(specs[i].id, toTeam)
		}
	}

	const isEnoughPlayers = () => ready().length >= maxTeamSize*2

	const _onPlayerJoin = room.onPlayerJoin
	room.onPlayerJoin = p => {
		_onPlayerJoin(p)
		addToGame(room, p)
	}

	const _onPlayerLeave = room.onPlayerLeave
	room.onPlayerLeave = async p => {
		await handlePlayerLeaveOrAFK(toAug(p))
		_onPlayerLeave(p)
	}

	if (room.getScores()) {
		isRunning = true
	}

	const _onTeamGoal = room.onTeamGoal
	room.onTeamGoal = team => {
		if (game) {
			game.inPlay = false
			game.positionsDuringPass = []
			players.forEach(p => p.canCallFoulUntil = 0)
			game.eventCounter += 1
			if (isRanked && !duringDraft) {
				const evC = game.eventCounter
				const gameId = game.id
				const dirKick = team == 1 ? -1 : 1
				setTimeout(() => {
					if (room.getBallPosition()?.x == 0 && room.getBallPosition()?.y == 0 && game?.eventCounter == evC && game?.id == gameId) {
						room.setDiscProperties(0, {xspeed: dirKick*2, yspeed: Math.random()})
						sendMessage('Ball was not touched for 35 seconds, therefore it is moved automatically.')
					}
				}, 35000)
			}
		}
		_onTeamGoal(team)
	}

	const _onTeamVictory = room.onTeamVictory
	room.onTeamVictory = async (scores) => {
		if (duringDraft) {
			return
		}
		if (_onTeamVictory) {
			_onTeamVictory(scores)
		}
		if (isRanked) {
			if (!game) { return }
			await handleWin(game)
		}
		const winTeam = scores.red > scores.blue ? 1 : 2
		const loseTeam = scores.red > scores.blue ? 2 : 1
		sendMessage('Break time: 10 seconds.')
		await sleep(10000)
		const winnerIds = room.getPlayerList().filter(p => p.team == winTeam).map(p => p.id)
		if (ready().length >= maxTeamSize*2) {
			const rd = ready()
			duringDraft = true
			room.getPlayerList().forEach(p => room.setPlayerAvatar(p.id, ""))
			const draftResult = await performDraft(room, rd, maxTeamSize, (p: PlayerObject) => toAug(p).afk = true);
			const rsStadium = fs.readFileSync('./maps/rs5.hbs', { encoding: 'utf8', flag: 'r' })
			room.setCustomStadium(rsStadium)
			room.getPlayerList().forEach(p => {
				if (p.team != 0) {
					room.setPlayerTeam(p.id, 0)
				}
			})
			draftResult?.red?.forEach(p => room.setPlayerTeam(p.id, 1))
			draftResult?.blue?.forEach(p => room.setPlayerTeam(p.id, 2))
			duringDraft = false
			if (draftResult?.red?.length == maxTeamSize && draftResult?.blue?.length == maxTeamSize) {
				isRanked = true
				sendMessage('Ranked game.')
			} else {
				sendMessage('Unranked game.')
				isRanked = false
				refill()
			}
		} else {
			isRanked = false
			let i = 0
			ready().forEach(p =>
											{
												if (i%2) {
													room.setPlayerTeam(p.id, 2)
												} else {
													room.setPlayerTeam(p.id, 1)
												}
												i++
											})
		}
		room.startGame()
	}

	//const _onGameStart = room.onGameStart
	//room.onGameStart = async byPlayer => {
	//	_onGameStart(byPlayer)
	//}

	// add that handlebalance when someone leaves or put someone from spec[0]
	//room.onPlayerLeave
}

const performDraft = async (room: RoomObject, players: PlayerObject[], maxTeamSize: number, afkHandler: Function) => {
			room.stopGame()
			players.forEach(p => room.setPlayerTeam(p.id, 0))
			const draftMap = fs.readFileSync('./maps/draft.hbs', { encoding: 'utf8', flag: 'r' })
			players = players.sort((a, b) => toAug(b).elo - toAug(a).elo)
			room.setCustomStadium(draftMap)
			// set blue players kickable (kicking them by red players results in
			// choose)
			players.slice(0,2).forEach(async p => {
				room.setPlayerTeam(p.id, 1);
			})
			await sleep(100)
			room.startGame()
			await sleep(100)
			players.slice(0,2).forEach(async p => {
				if (room.getPlayer(p.id)) {
					room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
				}
			})
			sendMessage('Draft has started. Captains choose players by KICKING (X).')
			let redPicker = players[0]
			let bluePicker = players[1]
			players.slice(2)
			.forEach(async p =>
				{ room.setPlayerTeam(p.id, 2)
					await sleep(100)
				if (room.getPlayer(p.id)) {
						room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.blue | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
					}
				})
			sendMessage('BLUE enter the draft area (20s).')
			await sleep(20000)
			room.getPlayerList().filter(p => p.team == 2).forEach(p => room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.blue | room.CollisionFlags.kick | room.CollisionFlags.c1 }))  // dont collide with middle line blocks and set kickable

			const setLock = (p: PlayerObject) => {
					const props = room.getPlayerDiscProperties(p.id)
					room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
					if (Math.abs(props.x) <= 55) {
						room.setPlayerDiscProperties(p.id, {x: Math.sign(props.x)*70})
					}
			}

			const setUnlock = (p: PlayerObject) => {
					room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c1 })
			}

			const redZone = {x: [-360, -210], y: [0, 300]}
			const blueZone = {x: [210, 360], y: [0, 300]}
			const midZone = {x: [-15, 15], y: [-300, 600]}

			const playersInZone = (zone: {x: number[], y: number[]}) => room.getPlayerList().filter(p => p.team == 2).filter(p => {
					if (!room.getScores()) { return [] }
					const props = room.getPlayerDiscProperties(p.id)
					return props.x > zone.x[0] && props.x < zone.x[1] && props.y > zone.y[0] && props.y < zone.y[1]
				})

			// segment [62] and [63] is middle draft block
			// segment [64] is left chooser block
			// segment [65] is right chooser block
			// f0c0f0 set cmask: c3
			// spawn: x: -150, y: 150
			// x: 25

			sendMessage(redPicker.name+' picks teammate...')
			sendMessage('PICK YOUR TEAMMATE by KICKING him!', redPicker)
			let pickingNow = 'red'
			let totalWait = 0
			const pickTimeLimit = 20000 // ms
			const sleepTime = 100 // ms
			setUnlock(redPicker)

			let previousMidZoneLength = 0
			while ( playersInZone(midZone).length != 0) {
				const setNewPickerRed = async () => {
					if (room.getPlayerList().map(p => p.id).includes(redPicker.id)) {
						room.setPlayerTeam(redPicker.id, 0)
						afkHandler(redPicker)
					}
					const midPlayers = playersInZone(midZone)
					redPicker = midPlayers[0]
					room.setPlayerTeam(redPicker.id, 1)
					await sleep(100)
					room.setPlayerDiscProperties(redPicker.id, {x: -120, y: 0})
					if (pickingNow == 'red') {
						setUnlock(redPicker)
					} else {
						setLock(redPicker)
					}
					totalWait = 0
				}

				const setNewPickerBlue = async () => {
					if (room.getPlayerList().map(p => p.id).includes(bluePicker.id)) {
						room.setPlayerTeam(bluePicker.id, 0)
						afkHandler(bluePicker)
					}
					const midPlayers = playersInZone(midZone)
					bluePicker = midPlayers[0]
					room.setPlayerTeam(bluePicker.id, 1)
					await sleep(100)
					room.setPlayerDiscProperties(bluePicker.id, {x: 120, y: 0})
					if (pickingNow == 'blue') {
						setUnlock(bluePicker)
					} else {
						setLock(bluePicker)
					}
					totalWait = 0
				}

				// if teams full
				if (playersInZone(redZone).length == maxTeamSize-1 && playersInZone(blueZone).length == maxTeamSize-1) {
					break
				}
				// if picker left
				if (!room.getPlayerList().map(p => p.id).includes(redPicker.id) || toAug(redPicker).afk) {
					sendMessage('Red picker left. Changing red picker...')
					await setNewPickerRed()
				}
				if (!room.getPlayerList().map(p => p.id).includes(bluePicker.id) || toAug(bluePicker).afk) {
					sendMessage('Blue picker left. Changing blue picker...')
					await setNewPickerBlue()
				}

				totalWait += sleepTime

				// reset wait if player was picked
				if (playersInZone(midZone).length != previousMidZoneLength) {
					previousMidZoneLength = playersInZone(midZone).length
					totalWait = 0
				}
				if (pickingNow == 'red') {
					if (playersInZone(redZone).length >= playersInZone(blueZone).length+1 || totalWait > pickTimeLimit) {
						if (totalWait > pickTimeLimit) {
							sendMessage('Timeout. Changing red picker...')
							await setNewPickerRed()
							continue
						}
						pickingNow = 'blue'
						sendMessage(bluePicker.name+' picks teammate...')
						sendMessage('Pick 2 players by KICKING them.', bluePicker);
						setUnlock(bluePicker)
						setLock(redPicker)
						totalWait = 0
						continue
					}
				} else {
					if (playersInZone(blueZone).length >= playersInZone(redZone).length+1 || totalWait > pickTimeLimit) {
						if (totalWait > pickTimeLimit) {
							sendMessage('Timeout. Changing blue picker...')
							await setNewPickerBlue()
							continue
						}
						pickingNow = 'red'
						sendMessage('Red captain picks teammate...')
						sendMessage('Pick 2 players by KICKING them!', redPicker)
						setUnlock(redPicker)
						setLock(bluePicker)
						totalWait = 0
						continue
					}
				}
				await sleep(sleepTime)
				if (!room.getScores()) {
					sendMessage('Draft cancelled.')
					break
				}
			}
			await sleep(100) // wait for last pick to arrive in box
			// fill empty spots with other
			const red = [...playersInZone(redZone), redPicker]
			const blue = [...playersInZone(blueZone), bluePicker]
			room.getPlayerList().filter(p => ![...red, ...blue, ...playersInZone(midZone)].map(pp => pp.id).includes(p.id)).forEach(p => afkHandler(p))
			room.stopGame()
			sendMessage('Draft finished.')
			return { red, blue }
}

export default initChooser;
