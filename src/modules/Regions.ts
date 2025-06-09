import { Context } from "hono";
export class Regions {
	c: Context<any>;

	constructor(c: any) {
		this.c = c;
	}

	async getRegionList(): Promise<Record<string, { id: string; location: string }>> {
		return this.c.env.REGIONS;
	}


	async getIdRegion() {
		const regions = await this.getRegionList();

		// @ts-ignore
		const response = await fetch(this.c.env.HOST_URL, {
			headers: {
				"Authorization": `Bearer ${this.c.env.HOST_TOKEN}`
			}
		});
		const data = await response.json();
		const reg = data.resourceConfig.functionDefaultRegions.at(0);

		return regions?.[reg as keyof typeof regions] || {
			id: reg,
			location: "N/A"
		};
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