import { Injectable, Logger } from '@nestjs/common';
import { TaskRepository } from '../../../database/repositories/task.repository';
import { OrderRepository } from '../../../database/repositories/order.repository';
import { TaskReleaseService } from './task-release.service';
import { ReassignmentService } from './reassignment.service';
import { EarlyReallocationService } from './early-reallocation.service';
import { ReleaseReason } from '../types/reallocation.types';

@Injectable()
export class DeadlineMonitorService {
    private readonly logger = new Logger(DeadlineMonitorService.name);

    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly orderRepo: OrderRepository,
        private readonly releaseService: TaskReleaseService,
        private readonly reassignmentService: ReassignmentService,
        private readonly earlyService: EarlyReallocationService,
    ) { }

    async monitorDeadlines(earlyReallocationHours: number = 1, campaignAutoExtensionHours: number = 10) {
        this.logger.log('Starting Deadline Monitor cycle...');

        // 1. Process Early Reallocations (1 hour before deadline)
        const earlyResults = await this.earlyService.evaluateEarlyReallocations(earlyReallocationHours);

        // 2. Process Full Timeouts (Past 100% deadline)
        const timeoutResults = await this.processFullTimeouts();

        // 3. Process Campaign Auto-Extensions (+10 hours if campaign incomplete at expiry date)
        const extensionResults = await this.processCampaignAutoExtensions(campaignAutoExtensionHours);

        return {
            earlyResults,
            timeoutResults,
            extensionResults,
        };
    }

    private async processFullTimeouts(): Promise<{ expiredCount: number; reallocatedCount: number }> {
        const now = new Date();
        const activeAssignedTasks = await this.taskRepo.findAssignedTasks();
        let expiredCount = 0;
        let reallocatedCount = 0;

        for (const task of activeAssignedTasks) {
            const campaignId = task.campaignId || task.orderId;
            const assignedWorkerId = task.assignedTo;

            if (!assignedWorkerId || !task.deadline) continue;

            const shieldedStatuses = ['SUBMITTED', 'submitted', 'UNDER_REVIEW', 'under_review', 'APPROVED', 'approved', 'completed'];
            if (shieldedStatuses.includes(task.status)) continue;

            if (new Date(task.deadline) < now) {
                this.logger.warn(`FULL TIMEOUT: Task '${task.id}' expired for Worker '${assignedWorkerId}'.`);

                const released = await this.releaseService.releaseWorkerFromTask({
                    taskId: task.id,
                    workerId: assignedWorkerId,
                    campaignId,
                    reason: ReleaseReason.WORKER_TIMEOUT,
                    details: 'Full task completion deadline expired',
                });

                if (released) {
                    expiredCount++;
                    const newWorkerId = await this.reassignmentService.reassignTaskToNewWorker(task.id, campaignId);
                    if (newWorkerId) reallocatedCount++;
                }
            }
        }

        return { expiredCount, reallocatedCount };
    }

    private async processCampaignAutoExtensions(extensionHours: number = 10): Promise<{ extendedCampaignsCount: number }> {
        const now = new Date();
        let extendedCampaignsCount = 0;

        // Auto-extend incomplete active orders whose campaignExpiryDate has passed
        const activeOrders = await this.orderRepo.findActiveOrders();
        for (const order of activeOrders) {
            const expiryDate = order.campaignExpiryDateSnapshot || order.campaignExpiryDate;
            if (expiryDate && new Date(expiryDate) < now && order.tasksCompleted < order.totalTasksRequired) {
                const newExpiryDate = new Date(now.getTime() + extensionHours * 3600 * 1000);
                await this.orderRepo.update(order.id, {
                    campaignExpiryDate: newExpiryDate,
                    campaignExpiryDateSnapshot: newExpiryDate,
                });
                extendedCampaignsCount++;
                this.logger.log(
                    `CAMPAIGN AUTO-EXTENDED: Order '${order.id}' extended by +${extensionHours} hours to ${newExpiryDate.toISOString()} for remaining ${order.totalTasksRequired - order.tasksCompleted} tasks.`,
                );
            }
        }

        return { extendedCampaignsCount };
    }
}
