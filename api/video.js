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
  const qualityLabel = params.quality || "480p"

  if (
    process.env.GET_AUTH_TOKEN &&
    process.env.GET_AUTH_TOKEN !== params.token
  ) {
    micro.send(res, 401, "you do not have auth header")
    return
  }

  if (!params.video_url) {
    micro.send(res, 400, 'You forgot the "video_url", you idiot!')
    return
  }

  const youtubeId = ytdl.getVideoID(params.video_url)

  const videoBuffer = await new Promise((resolve) => {
    redisClient.get(
      `video:${youtubeId}:${qualityLabel}`,
      (err, videoBuffer) => {
        if (err) {
          resolve(null)
          return
        }
        resolve(videoBuffer)
      }
    )
  })

  if (videoBuffer) {
    console.log("returning from cache")
    micro.send(res, 200, videoBuffer)
    return
  }

  const tmpFileObj = tmp.fileSync()
  const writeStream = ytdl(params.video_url, {
    // filter: (format) => format.qualityLabel === qualityLabel,
  })
  const fileWriteStream = fs.createWriteStream(tmpFileObj.name)
  writeStream.pipe(fileWriteStream)
  micro.send(res, 200, writeStream)
  fileWriteStream.on("finish", () => {
    redisClient.set(
      `video:${youtubeId}:${qualityLabel}`,
      fs.readFileSync(tmpFileObj.name)
    )
    tmpFileObj.removeCallback()
  })
}
