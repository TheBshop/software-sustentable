import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';

await mongoose.connect(env.mongoUri);
console.log('MongoDB conectado');

createApp().listen(env.port, () => console.log(`API escuchando en http://localhost:${env.port}`));
