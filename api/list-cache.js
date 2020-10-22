const micro = require("micro")
const redis = require("redis")
const redisClient = redis.createClient(
  process.env.REDIS_URL || "redis://localhost"
)

module.exports = async (req, res) => {
  const params = query(req)

  if (
    process.env.GET_AUTH_TOKEN &&
    process.env.GET_AUTH_TOKEN !== params.token
  ) {
    micro.send(res, 401, "you do not have auth header")
    return
  }

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
