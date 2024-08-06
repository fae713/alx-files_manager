import Queue from 'bull';
import { promises as fs } from 'fs';
import imageThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
  const { fileId } = job.data;

  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  const thumbnails = await Promise.all(sizes.map(async (size) => {
    const thumbnail = await imageThumbnail(file.localPath, { width: size });
    const thumbPath = `${file.localPath}_${size}`;
    await fs.writeFile(thumbPath, thumbnail);
    return thumbPath;
  }));

  await dbClient.db.collection('files').updateOne({ _id: new ObjectId(fileId) }, { $set: { thumbnails } });
});
