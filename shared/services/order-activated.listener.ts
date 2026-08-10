import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskEngineService } from '../../task-engine/task-engine.service';
import { OrderRepository } from '../database/repositories/order.repository';

export interface OrderActivatedEventPayload {
    orderId: string;
    buyerId: string;
    serviceCode: string;
    totalTasksRequired: number;
    workerRewardSnapshot: number;
    paymentTransactionId?: string;
    activatedAt: Date;
}

@Injectable()
export class OrderActivatedListener {
    private readonly logger = new Logger(OrderActivatedListener.name);

    constructor(
        private readonly taskEngine: TaskEngineService,
        private readonly orderRepo: OrderRepository,
    ) { }

    @OnEvent('order.activated')
    async handleOrderActivated(payload: OrderActivatedEventPayload) {
        this.logger.log(
            `Handling 'order.activated' event for Order '${payload.orderId}'. Generating ${payload.totalTasksRequired} tasks with reward ₹${payload.workerRewardSnapshot}/task.`,
        );

        try {
            const order = await this.orderRepo.findById(payload.orderId);
            if (!order) {
                this.logger.error(`Order '${payload.orderId}' not found during task generation event handling.`);
                return;
            }

            const rewardAmount = payload.workerRewardSnapshot || Number(order.workerRewardSnapshot || order.rewardPerTask || 5);

            for (let i = 0; i < payload.totalTasksRequired; i++) {
                await this.taskEngine.createTask({
                    orderId: payload.orderId,
                    campaignId: payload.orderId,
                    taskType: payload.serviceCode || order.taskType,
                    requirements: order.requirements,
                    rewardAmount,
                });
            }

            this.logger.log(`Successfully generated ${payload.totalTasksRequired} tasks for Order '${payload.orderId}'.`);
        } catch (error) {
            this.logger.error(
                `Error generating tasks for activated Order '${payload.orderId}': ${error.message}`,
                error.stack,
            );
        }
    }
}
