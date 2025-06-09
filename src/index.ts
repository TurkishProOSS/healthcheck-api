import { Hono } from 'hono'
import { Regions } from './modules/Regions'
import { Healthcheck } from './modules/Healthcheck'

const app = new Hono()

app.notFound((c) => c.redirect('https://turkishpro.gg', 301));

app.get('/', async (c) => {
	const regions = new Regions(c);
	const healthcheck = new Healthcheck(c, await regions.getRegions());
	const data = await healthcheck.getStatusPageData();
	return c.json(data)
})

export default app
