import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
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

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;

    const query = { userId: new ObjectId(userId), parentId: parentId === '0' ? 0 : new ObjectId(parentId) };
    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    const formattedFiles = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.status(200).json(formattedFiles);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: new ObjectId(fileId), userId: new ObjectId(userId) },
      { $set: { isPublic: true } },
      { returnDocument: 'after' },
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file.value._id,
      userId: file.value.userId,
      name: file.value.name,
      type: file.value.type,
      isPublic: file.value.isPublic,
      parentId: file.value.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: new ObjectId(fileId), userId: new ObjectId(userId) },
      { $set: { isPublic: false } },
      { returnDocument: 'after' },
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file.value._id,
      userId: file.value.userId,
      name: file.value.name,
      type: file.value.type,
      isPublic: file.value.isPublic,
      parentId: file.value.parentId,
    });
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!file.localPath) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const data = await fs.readFile(file.localPath);
      const mimeType = mime.lookup(file.name);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(data);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
