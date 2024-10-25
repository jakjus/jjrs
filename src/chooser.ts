import { PlayerAugmented } from "..";
import { sleep } from "./utils";
import * as fs from 'fs';
import { toAug } from "..";

const initChooser = (room: RoomObject) => {
	let isRunning: boolean = false;
	let isRanked: boolean = false;
	let duringDraft: boolean = false;
	const maxTeamSize = 2

	const red = () => room.getPlayerList().filter(p => p.team == 1)
	const blue = () => room.getPlayerList().filter(p => p.team == 2)
	const spec = () => room.getPlayerList().filter(p => p.team == 0)
	const both = () => room.getPlayerList().filter(p => p.team == 1 || p.team == 2)
	const ready = () => room.getPlayerList().filter(p => !toAug(p).afk)
	console.log('playerlist', room.getPlayerList())

	const addToGame = (p: PlayerObject) => {
		if (red().length > blue().length) {
			room.setPlayerTeam(p.id, 2)
		} else {
			room.setPlayerTeam(p.id, 1)
		}
	}

	const balanceTeams = () => {
		// To be used only during unranked
		if (red().length > blue().length+1) {
			room.setPlayerTeam(red()[0].id, 2)
		} else if (red().length+1 < blue().length) {
			room.setPlayerTeam(blue()[0].id, 1)
		}
	}

	const isEnoughPlayers = () => ready().length >= maxTeamSize*2

	const _onPlayerJoin = room.onPlayerJoin
	room.onPlayerJoin = p => {
		_onPlayerJoin(p)
		if (!isRanked) {
			addToGame(p)
		}
	}

	const _onPlayerLeave = room.onPlayerLeave
	room.onPlayerLeave = p => {
		if (!isEnoughPlayers()) {
			isRanked = false
		}
		if (!isRanked) {
			balanceTeams()
		}
		_onPlayerLeave(p)
	}

	if (room.getScores()) {
		isRunning = true
	}

	const _onGameStop = room.onGameStop
	room.onGameStop = async (byPlayer) => {
		_onGameStop(byPlayer)
		if (isRanked) {
			room.sendAnnouncement('it was ranked. handling elo.')
		}
		room.sendAnnouncement('5 seconds break')
		await sleep(5000)
		if (isEnoughPlayers()) {
			const rd = ready()
			duringDraft = true
			const draftResult = await performDraft(room, rd, maxTeamSize);
			duringDraft = false
		}
		// move players
			//draftResult.red, draftResult.blue, draftResult.full
		room.startGame()
	}

	const _onGameStart = room.onGameStart
	room.onGameStart = async byPlayer => {
		if (duringDraft) {
			return
		}

		if (isEnoughPlayers()) {
			isRanked = true
			room.sendAnnouncement('ranked game')
		} else {
			room.sendAnnouncement('non ranked game')
		}
		_onGameStart(byPlayer)
	}

	// add that handlebalance when someone leaves or put someone from spec[0]
	//room.onPlayerLeave
}

const performDraft = async (room: RoomObject, rd: PlayerObject[], maxTeamSize: number) => {
			room.sendAnnouncement('draft starts. pick players')
			const draftMap = fs.readFileSync('./draft.hbs', { encoding: 'utf8', flag: 'r' })
			room.setCustomStadium(draftMap)
			room.startGame()
			// set blue players kickable (kicking them by red results in
			// choose)
			rd.slice(0,2).forEach(p => {
				room.setPlayerTeam(p.id, 1);
				room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
			})
			const redPicker = rd[0]
			const bluePicker = rd[1]
			rd.slice(2).forEach(p =>
													{ room.setPlayerTeam(p.id, 2)
													room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.blue | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
													})
			room.sendAnnouncement('enter the draft area (15s)')
			await sleep(15000)
			room.getPlayerList().filter(p => p.team == 2).forEach(p => room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.blue | room.CollisionFlags.kick | room.CollisionFlags.c1 }))  // dont collide with middle line blocks and set kickable
			const setLock = (p: PlayerObject) => {
					const props = room.getPlayerDiscProperties(p.id)
					room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c3 | room.CollisionFlags.c1 })
					if (Math.abs(props.x) <= 48) {
						room.setPlayerDiscProperties(p.id, {x: Math.sign(props.x)*63})
					}
			}

			const setUnlock = (p: PlayerObject) => {
					room.setPlayerDiscProperties(p.id, { cGroup: room.CollisionFlags.red | room.CollisionFlags.c1 })
			}

			const redZone = {x: [-360, -210], y: [0, 300]}
			const blueZone = {x: [210, 360], y: [0, 300]}

			const playersInZone = (zone: {x: number[], y: number[]}) => room.getPlayerList().filter(p => p.team == 2).filter(p => {
				if (!room.getScores()) {
					console.log('DRAFT: Map was stopped, quitting draft...')
					return
				}
					const props = room.getPlayerDiscProperties(p.id)
					return props.x > zone.x[0] && props.x < zone.x[1] && props.y > zone.y[0] && props.y < zone.y[1]
				})
			// segment [62] and [63] is middle draft block
			// segment [64] is left chooser block
			// segment [65] is right chooser block
			// f0c0f0 set cmask: c3
			// spawn: x: -150, y: 150
			// x: 25

			room.sendAnnouncement('p1 picks teammate')
			let pickingNow = 'red'
			setUnlock(redPicker)
			while (playersInZone(redZone).length != maxTeamSize-1 || playersInZone(blueZone).length != maxTeamSize-1) {
				if (pickingNow == 'red') {
					if (playersInZone(redZone).length >= playersInZone(blueZone).length+1) {
						pickingNow = 'blue'
						room.sendAnnouncement('p2 picks teammate')
						setUnlock(bluePicker)
						setLock(redPicker)
						continue
					}
					//check and if success, currentPickIndex+=1
				} else {
					if (playersInZone(blueZone).length >= playersInZone(redZone).length+1) {
						pickingNow = 'red'
						room.sendAnnouncement('p1 picks teammate')
						setUnlock(redPicker)
						setLock(bluePicker)
						continue
					}
				}
				room.sendAnnouncement('sleeping...')
				await sleep(1000)
			}
			// fill empty spots with other
			const red = [...playersInZone(redZone), redPicker]
			const blue = [...playersInZone(blueZone), redPicker]
			room.stopGame()
			room.sendAnnouncement('finished')
			console.log('draft result: ', { red, blue, full: true })
			return { red, blue, full: true }
}

export default initChooser;
