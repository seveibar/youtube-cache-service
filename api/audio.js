const ytdl = require("ytdl-core")
const query = require("micro-query")
const tmp = require("tmp")
const micro = require("micro")
const fs = require("fs")

const redis = require("redis")
const redisClient = redis.createClient(
  process.env.REDIS_URL || "redis://localhost",
  {
    return_buffers: true,
  }
)

module.exports = async (req, res) => {
  const params = query(req)

  if (process.env.GET_AUTH_TOKEN) {
    if (process.env.GET_AUTH_TOKEN !== params.token) {
      micro.send(res, 401, "you do not have auth header")
    } else if (!params.token) {
      micro.send(res, 401, "you need to supply auth token")
    }
  }

  if (!params.video_url) {
    micro.send(res, 400, 'You forgot the "video_url", you idiot!')
    return
  }

  const youtubeId = ytdl.getVideoID(params.video_url)

  const audioBuffer = await new Promise((resolve) => {
    redisClient.get(`audio:${youtubeId}`, (err, audioBuffer) => {
      if (err) {
        resolve(null)
        return
      }
      resolve(audioBuffer)
    })
  })

  if (audioBuffer) {
    console.log("returning from cache")
    micro.send(res, 200, audioBuffer)
    return
  }

  const tmpFileObj = tmp.fileSync()
  const writeStream = ytdl(params.video_url, {
    quality: "highestaudio",
    filter: "audioonly",
  })
  const fileWriteStream = fs.createWriteStream(tmpFileObj.name)
  writeStream.pipe(fileWriteStream)
  micro.send(res, 200, writeStream)
  fileWriteStream.on("finish", () => {
    redisClient.set(`audio:${youtubeId}`, fs.readFileSync(tmpFileObj.name))
    tmpFileObj.removeCallback()
  })
}
