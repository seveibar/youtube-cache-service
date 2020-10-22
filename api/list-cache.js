const micro = require("micro")
const redis = require("redis")
const redisClient = redis.createClient(
  process.env.REDIS_URL || "redis://localhost"
)

module.exports = async (req, res) => {
  const allKeys = await new Promise((resolve) => {
    redisClient.keys("*", (err, keys) => {
      if (err) {
        micro.send(res, 500, err.toString())
        return
      }
      resolve(keys)
    })
  })
  res.end(JSON.stringify(allKeys))
}
