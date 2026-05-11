import { Client } from 'pg';
import 'dotenv/config';

async function testConnection() {
  const client = new Client({
    user: process.env.USERNAME_DATABASE,
    host: process.env.HOST_DATABASE,
    database: process.env.DATABASE,
    password: process.env.PASSWORD_DATABASE,
    port: parseInt(process.env.PORT_DATABASE || '5432'),
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('Connecting to database...');
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Current time from DB:', res.rows[0].now);
    await client.end();
    console.log('Connection closed.');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testConnection();
