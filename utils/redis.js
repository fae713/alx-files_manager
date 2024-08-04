const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    this.client.on('error', (err) => {
      console.error('Redis client not connected to the server:', err);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          reject(new Error(`Error getting the key value from Redis: ${err.message}`));
        } else {
          resolve(reply);
        }
      });
    });
  }

  async set(key, value, mode, duration) {
    return new Promise((resolve, reject) => {
      if (mode && duration) {
        this.client.set(key, value, mode, parseInt(duration, 10), (err, reply) => {
          if (err) reject(err);
          resolve(reply);
        });
      } else {
        this.client.set(key, value, (err, reply) => {
          if (err) reject(err);
          resolve(reply);
        });
      }
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) {
          reject(new Error(`Error deleting value from Redis: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
