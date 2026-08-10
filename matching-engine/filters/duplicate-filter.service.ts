import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../shared/database/repositories/task.repository';
import { MatchingContext } from '../types';

/**
 * Duplicate task assignment prevent karta hai
 * Same order/campaign mein worker ko same task type baar baar nahi milega
 */
@Injectable()
export class DuplicateFilterService {
    constructor(private readonly taskRepo: TaskRepository) { }

    async apply(workerIds: string[], context: MatchingContext): Promise<string[]> {
        const { orderId, campaignId } = context.task;
        const eligibleWorkers: string[] = [];

        for (const workerId of workerIds) {
            // Check if worker already has task from same order
            const existingTasks = await this.taskRepo.findByWorker(workerId);

            const hasDuplicate = existingTasks.some(task =>
                task.orderId === orderId || task.campaignId === campaignId
            );

            if (!hasDuplicate) {
                eligibleWorkers.push(workerId);
            }
        }

        return eligibleWorkers;
    }
}
