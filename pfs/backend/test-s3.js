require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function run() {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    console.log(`Uploading to bucket: ${bucketName}...`);
    const data = await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test-upload.txt',
      Body: 'Hello world',
      ContentType: 'text/plain'
    }));
    console.log("SUCCESS PUT");
  } catch (err) {
    console.error("ERROR PUT:", err);
  }
}
run();
