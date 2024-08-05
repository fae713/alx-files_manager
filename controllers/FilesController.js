import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId !== 0) {
      parentFile = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const documentsFile = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentFile ? parentFile._id : 0,
    };

    if (type === 'folder') {
      const dbFolder = await dbClient.db.collection('files').insertOne(documentsFile);
      return res.status(201).json({
        id: dbFolder.ops[0]._id,
        userId: dbFolder.ops[0].userId,
        name: dbFolder.ops[0].name,
        type: dbFolder.ops[0].type,
        isPublic: dbFolder.ops[0].isPublic,
        parentId: dbFolder.ops[0].parentId,
      });
    }

    const localPath = path.join(FOLDER_PATH, uuidv4());
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, Buffer.from(data, 'base64'));

    documentsFile.localPath = localPath;

    const dbFolder = await dbClient.db.collection('files').insertOne(documentsFile);
    return res.status(201).json({
      id: dbFolder.ops[0]._id,
      userId: dbFolder.ops[0].userId,
      name: dbFolder.ops[0].name,
      type: dbFolder.ops[0].type,
      isPublic: dbFolder.ops[0].isPublic,
      parentId: dbFolder.ops[0].parentId,
      // localPath: dbFolder.ops[0].localPath
    });
  }
}

export default FilesController;
