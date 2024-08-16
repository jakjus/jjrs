import { room, Game } from '../index';
import { mapBounds, goals } from './settings';


export const handleBallOutOfBounds = async (game: Game, room: RoomObject) => {
	if (!game.active) { return }
	const ballPos = room.getBallPosition()
	// LEFT BORDER, but not in GOAL
	if (ballPos.x < mapBounds.x[0] && ballPos.y < goals.y[0] && ballPos.y > goals.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			if (ballPos.y > 0) {
				cornerKick(game, 2, { x: mapBounds.x[0], y: mapBounds.y[0] })
			} else {
				cornerKick(game, 2, { x: mapBounds.x[0], y: mapBounds.y[1] })
			}
		} else if (game.lastTouch?.byPlayer.team == 2) {
			goalKick(game, 1, { x: mapBounds.x[0] + 100, y: 0 })
		}
	}
	// RIGHT BORDER, but not in GOAL
	else if (ballPos.x > mapBounds.x[1] && ballPos.y < goals.y[0] && ballPos.y > goals.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			if (ballPos.y > 0) {
				cornerKick(game, 1, { x: mapBounds.x[1], y: mapBounds.y[0] })
			} else {
				cornerKick(game, 1, { x: mapBounds.x[0], y: mapBounds.y[1] })
			}
		} else if (game.lastTouch?.byPlayer.team == 2) {
			goalKick(game, 2, { x: mapBounds.x[1] - 100, y: 0 })
		}
	}
	// UPPER BORDER
	else if (ballPos.y > mapBounds.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			throwIn(game, 2, {x: ballPos.x, y: mapBounds.y[1]})
		} else if (game.lastTouch?.byPlayer.team == 2) {
			throwIn(game, 1, {x: ballPos.x, y: mapBounds.y[1]})
		}
	}
	// LOWER BORDER
	else if (ballPos.y < mapBounds.y[0]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			throwIn(game, 2, {x: ballPos.x, y: mapBounds.y[0]})
		} else if (game.lastTouch?.byPlayer.team == 2) {
			throwIn(game, 1, {x: ballPos.x, y: mapBounds.y[0]})
		}
	}
}

const cornerKick = (game, forTeam: TeamID, pos: Partial<DiscPropertiesObject>) => {
	// colorBall(forTeam, )
	game.active = false
	room.setDiscProperties(0, pos)
}

const goalKick = (game, forTeam, pos: Partial<DiscPropertiesObject>) => {
	room.setDiscProperties(0, pos)
	game.active = false
}

const throwIn = (game, forTeam, pos: Partial<DiscPropertiesObject>) => {
	room.setDiscProperties(0, pos)
	game.active = false
}
