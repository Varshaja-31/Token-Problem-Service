/* eslint-disable import/order */

import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';

import { SanitizeENV } from 'utils/sanitizeEnv';
import { TokenLayer } from 'services/token';


SanitizeENV(process.env);

const {
  PORT,
  NODE_ENV,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_ENABLED,
} = process.env;


// Bootstrap Redis
if (parseInt(REDIS_ENABLED)) {
  new TokenLayer({
    host : REDIS_HOST,
    port : REDIS_PORT,
    username : REDIS_USERNAME,
    password : REDIS_PASSWORD
  }).connect()
} 


const app = express();

app.use(helmet.hidePoweredBy());
app.use(helmet());

import RouteManager from './routes';
import bodyParser from 'body-parser';

app.use(bodyParser.json())


app.use('/token-manager', RouteManager);

app.listen(PORT, () => {
  console.log(`STARTING TOKEN-SERVICE SERVER ON PORT - ${PORT} ENVIRONMENT - ${NODE_ENV}`, { component: 'EXPRESS' });
});

process.on('unhandledRejection', (error) => {
  console.error(`UNHANDLED REJECTION`, { component: 'EXPRESS', error });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`UNCAUGHT EXCEPTION`, { component: 'EXPRESS', error });
  process.exit(1);
});
