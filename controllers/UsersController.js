import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const existingUser = await dbClient.db.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

      const newUser = {
        email,
        password: hashedPassword,
      };

      const updatedDB = await dbClient.db.collection('users').insertOne(newUser);

      return res.status(201).json({
        email: newUser.email,
        id: updatedDB.insertedId.toString(),
      });
    } catch (err) {
      console.error('Error inserting new user:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UsersController;
