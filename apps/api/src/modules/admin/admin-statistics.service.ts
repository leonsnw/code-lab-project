import type { CodeLabStore } from "../../database/codelab-store.js";
import {
  buildAdminStatistics,
  type AdminStatistics
} from "../../domain/admin-statistics.js";

export interface GeneratedAdminStatistics extends AdminStatistics {
  generatedAt: Date;
}

export class AdminStatisticsService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(): Promise<GeneratedAdminStatistics> {
    const data = await this.store.getAdminStatisticsData();
    return {
      generatedAt: this.now(),
      ...buildAdminStatistics(data)
    };
  }
}
