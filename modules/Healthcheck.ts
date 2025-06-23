

import { Context } from "hono";
export class Healthcheck {
	regions: Record<string, { id: string; location: string }>;
	private sections: any[] = [];
	private resources: any[] = [];
	private reports: any[] = [];

	constructor(regions: Record<string, { id: string; location: string }>) {
		this.regions = regions;
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
		const url = `${process.env.FETCH_URL}/${endpoint}`;
		// @ts-ignore
		return fetch(url, {
			headers: {
				"Authorization": `Bearer ${process.env.FETCH_TOKEN}`
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
			const region = this.regions?.[attributes.public_name as keyof typeof this.regions] || {};
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