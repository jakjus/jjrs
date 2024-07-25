import Keyv from "keyv";

export const keyv = new Keyv('sqlite://db.sqlite')
keyv.on('error', err => console.log('Keyv Error:', err));

const migrate = async () => {
    for await (const [key, value] of keyv.iterator()) {
        console.log('pre:', key, value)
        if (value.started) {
            let newValue = {...value} // shallow copy
            value.mapStats = {}
            value.mapStats["winkys-challenge"] = {
                started: newValue.started,
                checkpoint: newValue.checkpoint,
                finished: newValue.finished,
                bestTime: newValue.bestTime,
            }
            delete value.started
            delete value.checkpoint
            delete value.finished
            delete value.bestTime
        }
        console.log('post:', key, value)
        keyv.set(key, value)
    };
}

migrate()
