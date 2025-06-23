import { Hono } from '@hono/hono'
import { handle } from '@hono/hono/netlify'
import { cors } from '@hono/hono/cors'

const app = new Hono()

app.use('*', cors({
	origin: '*',
	allowMethods: ['GET']
}));

app.get('/', async (c) => {
	// @ts-ignore
	const region = new Regions(process.env)
	const regions = await region.getRegionList()
	// @ts-ignore
	const healthcheck = new Healthcheck(process.env)
	const healthcheckData = await healthcheck.getStatusPageData()
	return c.json({
		regions,
		healthcheckData
	})
})

export default handle(app)


// Regions
class Regions {
	env: any;

	constructor(env: any) {
		this.env = env;
	}

	async getRegionList(): Promise<Record<string, { id: string; location: string }>> {
		return JSON.parse(this.env.REGIONS || "{}");
	}


	async getIdRegion() {
		try {
			const regions = await this.getRegionList();

			// @ts-ignore
			const response = await fetch(this.env.HOST_URL, {
				headers: {
					"Authorization": `Bearer ${this.env.HOST_TOKEN}`
				}
			});
			const data = await response.json();
			const reg = data.resourceConfig.functionDefaultRegions.at(0);

			return regions?.[reg as keyof typeof regions] || {
				id: reg,
				location: "N/A"
			};
		} catch (error) {
			return {
				id: "N/A",
				location: "N/A"
			};
		}
	}

	async getApiRegion() {
		const regions = await this.getRegionList();
		return regions.ist1;
	}

	async getRegions() {
		return {
			"id.turkishpro.gg": await this.getIdRegion(),
			"api.turkishpro.gg": await this.getApiRegion()
		}
	}
}


// Healthcheck
class Healthcheck {
	private sections: any[] = [];
	private resources: any[] = [];
	private reports: any[] = [];
	env: any;

	constructor(env: any) {
		this.env = env;
	}

	async fetchData() {
		try {
			const [sectionsRes, resourcesRes, reportsRes] = await (await Promise.all([
				this.fetchFrom("sections"),
				this.fetchFrom("resources"),
				this.fetchFrom("status-reports")
			]));

			const sections = await sectionsRes.json();
			const resources = await resourcesRes.json();
			const reports = await reportsRes.json();
			if (!sectionsRes.ok || !resourcesRes.ok || !reportsRes.ok) {
				throw new Error("Failed to fetch data from status page API");
			}

			this.sections = sections.data;
			this.resources = resources.data;
			this.reports = reports?.data?.filter((report: any) => new Date(report.attributes.ends_at) > new Date()) || [];
		} catch (error) {
			this.sections = [];
			this.resources = [];
			this.reports = [];
		}
	}

	private fetchFrom(endpoint: string) {
		const url = `${this.env.FETCH_URL}/${endpoint}`;
		// @ts-ignore
		return fetch(url, {
			headers: {
				"Authorization": `Bearer ${this.env.FETCH_TOKEN}`
			}
		});
	}

	private mapResources() {
		return this.resources.map((resource: any) => {
			const attributes = resource.attributes;
			const report = this.reports.find((r: any) =>
				r.attributes.affected_resources.some(
					(res: any) => res.status_page_resource_id === resource.id
				)
			);
			const region = this.env.REGIONS?.[attributes.public_name as keyof typeof this.env.REGIONS] || {};
			const section = this.sections.find((s: any) => +s.id === attributes.status_page_section_id);

			return {
				region_id: region?.id || "N/A",
				region_location: region?.location || "N/A",
				name: attributes.public_name,
				status: attributes.status,
				reason: report?.attributes?.title || null,
				is_vital: section?.attributes?.name?.endsWith?.("*") || false
			};
		});
	}

	private getStatus(resources: any[]) {
		const maintenance = resources.filter(r => r.status === "maintenance");
		const downtime = resources.filter(r => r.status === "downtime");

		const vitalMaintenance = maintenance.filter(r => r.is_vital);
		const vitalDowntime = downtime.filter(r => r.is_vital);

		let count = 0;
		if (maintenance.length > 0) count++;
		if (downtime.length > 0) count++;

		if (vitalMaintenance.length > 0) return "maintenance";
		if (vitalDowntime.length > 0) return "downtime";

		if (count === 0) return "operational";
		return maintenance.length > downtime.length ? "maintenance" : "downtime";
	}

	private getVitalStatus(resources: any[]) {
		return resources.some(r => r.is_vital && (r.status === "maintenance" || r.status === "downtime"))
			? "downtime"
			: "operational";
	}

	async getStatusPageData() {
		await this.fetchData();

		const mappedResources = this.mapResources();
		const notOperational = mappedResources.filter(r => r.status !== "operational");
		const affectedRegions = notOperational.map(r => r.region_id).filter(id => id !== "N/A");

		return {
			vital_status: this.getVitalStatus(mappedResources),
			status: this.getStatus(mappedResources),
			resources: mappedResources,
			affected_regions: affectedRegions,
			apps: notOperational.map(r => ({
				name: r.name,
				reason: r.reason || null,
				status: r.status
			}))
		};
	}
}