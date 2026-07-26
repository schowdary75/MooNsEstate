import express, { Request, Response } from 'express';
import connectDB from './db/config';
import route from './controllers/route';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const port: number = 5001;
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// API Routes
app.use('/api', route);

app.get('/', async (req: Request, res: Response) => {
    res.send('Welcome to MooNEstates API Server...');
});

const server = app.listen(port, () => {
    const protocol = (process.env.HTTPS === 'true' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
    const addressInfo = server.address();
    const host = typeof addressInfo === 'string' ? addressInfo : (addressInfo?.address === '::' ? '127.0.0.1' : addressInfo?.address || '127.0.0.1');
    console.log(`TypeScript Server listening at ${protocol}://${host}:${port}/`);
});

// Connect to MySQL via Prisma ORM
connectDB();
