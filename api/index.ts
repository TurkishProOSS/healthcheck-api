import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { Regions } from '../modules/Regions';
import { Healthcheck } from '../modules/Healthcheck';
import { cors } from 'hono/cors';

export const config = {
	runtime: 'edge'
};

const app = new Hono().basePath('/api');

app.use('*', cors({
	origin: '*',
	allowMethods: ['GET']
}));


app.get('/', async (c) => {
	const regions = new Regions();
	const health = new Healthcheck(await regions.getRegions())
	return c.json(await health.getStatusPageData())
});

export default handle(app)
