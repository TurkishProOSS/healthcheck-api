import { Context } from "hono";
export class Regions {
	async getRegionList(): Promise<Record<string, { id: string; location: string }>> {
		return JSON.parse(process.env.REGIONS || "{}");
	}


	async getIdRegion() {
		try {
			const regions = await this.getRegionList();

			// @ts-ignore
			const response = await fetch(process.env.HOST_URL, {
				headers: {
					"Authorization": `Bearer ${process.env.HOST_TOKEN}`
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