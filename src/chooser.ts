import { room } from "..";
import { sendMessage } from "./message";
import { sleep } from "./utils";
import * as fs from 'fs';
import { toAug } from "..";
import { maxTeamSize } from "./settings";

let isRunning: boolean = false;
let isRanked: boolean = false;
let duringDraft: boolean = false;
const red = () => room.getPlayerList().filter(p => p.team == 1)
const blue = () => room.getPlayerList().filter(p => p.team == 2)
const spec = () => room.getPlayerList().filter(p => p.team == 0)
const both = () => room.getPlayerList().filter(p => p.team == 1 || p.team == 2)
const ready = () => room.getPlayerList().filter(p => !toAug(p).afk)

export const addToGame = (room: RoomObject, p: PlayerObject) => {
	if (isRanked && [...red(), ...blue()].length <= maxTeamSize*2) {
		return
	}
	if (toAug(p).cardsAnnounced >= 2 || toAug(p).foulsMeter >= 2) {
		return
	}
	if (duringDraft) {
		room.setPlayerTeam(p.id, 2)
		return
	}
	if (red().length > blue().length) {
		room.setPlayerTeam(p.id, 2)
	} else {
		room.setPlayerTeam(p.id, 1)
	}
}

const initChooser = (room: RoomObject) => {
	const balanceTeams = () => {
		// To be used only during unranked
		if (red().length > blue().length+1) {
			room.setPlayerTeam(red()[0].id, 2)
		} else if (red().length+1 < blue().length) {
			room.setPlayerTeam(blue()[0].id, 1)
		}
	}

	const refill = () => {
		while (red().length + blue().length < maxTeamSize*2 && spec().filter(p => !toAug(p).afk).length > 0) {
			addToGame(room, spec()[0])
		}
	}

	const isEnoughPlayers = () => ready().length >= maxTeamSize*2

	const _onPlayerJoin = room.onPlayerJoin
	room.onPlayerJoin = p => {
		_onPlayerJoin(p)
		addToGame(room, p)
	}

	const _onPlayerLeave = room.onPlayerLeave
	room.onPlayerLeave = p => {
		if (!isEnoughPlayers()) {
			isRanked = false
			sendMessage('Unranked game.')
			refill()
			balanceTeams()
		}
		_onPlayerLeave(p)
	}

	if (room.getScores()) {
		isRunning = true
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
			sendMessage('It was ranked game, but ELO is not handled in this version.')
		}
		const winTeam = scores.red > scores.blue ? 1 : 2
		const loseTeam = scores.red > scores.blue ? 2 : 1
		sendMessage('Break time: 15 seconds.')
		await sleep(15000)
		const winnerIds = room.getPlayerList().filter(p => p.team == winTeam).map(p => p.id)
		if (ready().length >= 4) {
			const rd = ready()
			duringDraft = true
			room.getPlayerList().forEach(p => room.setPlayerAvatar(p.id, ""))
			const draftResult = await performDraft(room, rd, winnerIds, maxTeamSize, (p: PlayerObject) => toAug(p).afk = true);
			const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })
			room.setCustomStadium(rsStadium)
			duringDraft = false
			room.getPlayerList().forEach(p => {
				if (p.team != 0) {
					room.setPlayerTeam(p.id, 0)
				}
			})
			draftResult?.red?.forEach(p => room.setPlayerTeam(p.id, 1))
			draftResult?.blue?.forEach(p => room.setPlayerTeam(p.id, 2))
			if (draftResult?.red?.length == maxTeamSize && draftResult?.blue?.length == maxTeamSize) {
				isRanked = true
				sendMessage('Ranked game.')
			} else {
				sendMessage('Unranked game.')
				isRanked = false
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

	const _onGameStart = room.onGameStart
	room.onGameStart = async byPlayer => {
		if (duringDraft) {
			return
		}
		_onGameStart(byPlayer)
	}

	// add that handlebalance when someone leaves or put someone from spec[0]
	//room.onPlayerLeave
}

const performDraft = async (room: RoomObject, players: PlayerObject[], pickerIds: number[], maxTeamSize: number, afkHandler: Function) => {
			room.stopGame()
			players.forEach(p => room.setPlayerTeam(p.id, 0))
			if (pickerIds) {
				players.forEach((p, i) => {
					if (pickerIds.includes(p.id)){
						players.unshift(players.splice(i, 1)[0])
					}
				})
			}
			const draftMap = fs.readFileSync('./draft.hbs', { encoding: 'utf8', flag: 'r' })
			room.setCustomStadium(draftMap)
			sendMessage('Draft has started. Captains choose players by KICKING (X).')
			// set blue players kickable (kicking them by red players results in
			// choose)
			players.slice(0,2).forEach(p => {
				room.setPlayerTeam(p.id, 1);
				room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
			})
			room.startGame()
			let redPicker = players[0]
			let bluePicker = players[1]
			players.slice(2).forEach(p =>
													{ room.setPlayerTeam(p.id, 2)
													room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.blue | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
													})
			sendMessage('enter the draft area (25s)')
			await sleep(25000)
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

			sendMessage('Red captain picks teammate...')
			sendMessage('PICK YOUR TEAMMATE by KICKING him!', redPicker)
			let pickingNow = 'red'
			let totalWait = 0
			const pickTimeLimit = 15000 // ms
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
					room.setPlayerDiscProperties(redPicker.id, {x: -120, y: 0})
					if (pickingNow == 'red') {
						setUnlock(redPicker)
					} else {
						setLock(redPicker)
					}
					totalWait = 0
				}

				const setNewPickerBlue = () => {
					if (room.getPlayerList().map(p => p.id).includes(bluePicker.id)) {
						room.setPlayerTeam(bluePicker.id, 0)
						afkHandler(bluePicker)
					}
					const midPlayers = playersInZone(midZone)
					bluePicker = midPlayers[0]
					room.setPlayerTeam(bluePicker.id, 1)
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
				if (!room.getPlayerList().map(p => p.id).includes(redPicker.id)) {
					sendMessage('red picker left. changing red picker')
					setNewPickerRed()
				}
				if (!room.getPlayerList().map(p => p.id).includes(redPicker.id)) {
					sendMessage('blue picker left. changing blue picker')
					setNewPickerBlue()
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
							sendMessage('timeout')
							setNewPickerRed()
							continue
						}
						pickingNow = 'blue'
						sendMessage('p2 picks teammate')
						setUnlock(bluePicker)
						setLock(redPicker)
						totalWait = 0
						continue
					}
				} else {
					if (playersInZone(blueZone).length >= playersInZone(redZone).length+1 || totalWait > pickTimeLimit) {
						if (totalWait > pickTimeLimit) {
							sendMessage('timeout')
							setNewPickerBlue()
							continue
						}
						pickingNow = 'red'
						sendMessage('Red captain picks teammate...')
						sendMessage('PICK YOUR TEAMMATE by KICKING him!', redPicker)
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
			room.getPlayerList().filter(p => ![...red, ...blue].map(pp => pp.id).includes(p.id)).forEach(p => afkHandler(p))
			room.stopGame()
			sendMessage('Draft finished.')
			return { red, blue }
}

export default initChooser;
