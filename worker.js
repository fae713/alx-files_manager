import Bull from 'bull';
import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import dbClient from '../utils/db';

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
  if (!file) {
    return done(new Error('File not found'));
  }

  const options = [
    { width: 500 },
    { width: 250 },
    { width: 100 }
  ];

  try {
    for (const option of options) {
      const thumbnail = await imageThumbnail(file.localPath, option);
      const thumbnailPath = `${file.localPath}_${option.width}`;
      await fs.writeFile(thumbnailPath, thumbnail);
    }
    done();
  } catch (error) {
    done(error);
  }
});
