import Keyv from "keyv";

export const keyv = new Keyv('sqlite://db.sqlite')
keyv.on('error', err => console.log('Keyv Error:', err));

const removePoints = async () => {
    for await (const [key, value] of keyv.iterator()) {
        console.log('pre:', key, value)
        value.points = 0
        console.log('post:', key, value)
        keyv.set(key, value)
    };
}

removePoints()
