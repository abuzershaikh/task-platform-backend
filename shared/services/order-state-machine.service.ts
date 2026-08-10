import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderRepository } from '../database/repositories/order.repository';
import { Order } from '../database/entities/order.entity';

export enum OrderStatus {
    DRAFT = 'DRAFT',
    PAYMENT_PENDING = 'PAYMENT_PENDING',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

@Injectable()
export class OrderStateMachineService {
    private readonly logger = new Logger(OrderStateMachineService.name);

    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async transitionToActive(orderId: string, paymentTransactionId?: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID '${orderId}' not found`);
        }

        const validPrevStatuses = [OrderStatus.DRAFT, OrderStatus.PAYMENT_PENDING, 'draft', 'active'];
        if (!validPrevStatuses.includes(order.status)) {
            this.logger.warn(`Order '${orderId}' is already in status '${order.status}'`);
            return order;
        }

        const updated = await this.orderRepo.update(orderId, {
            status: OrderStatus.ACTIVE,
        });

        this.logger.log(`Order '${orderId}' status transitioned to ACTIVE. Dispatching 'order.activated' event.`);

        // Dispatch Event to decouple Payment Webhook from Task Engine
        this.eventEmitter.emit('order.activated', {
            orderId: order.id,
            buyerId: order.buyerId,
            serviceCode: order.serviceCode || order.taskType,
            totalTasksRequired: order.totalTasksRequired,
            workerRewardSnapshot: Number(order.workerRewardSnapshot || order.rewardPerTask),
            paymentTransactionId,
            activatedAt: new Date(),
        });

        return updated!;
    }

    async transitionToPaused(orderId: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID '${orderId}' not found`);
        }

        if (order.status !== OrderStatus.ACTIVE && order.status !== 'active') {
            throw new BadRequestException(`Cannot pause order with current status '${order.status}'`);
        }

        const updated = await this.orderRepo.update(orderId, { status: OrderStatus.PAUSED });
        this.eventEmitter.emit('order.paused', { orderId });
        return updated!;
    }

    async transitionToResume(orderId: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID '${orderId}' not found`);
        }

        if (order.status !== OrderStatus.PAUSED) {
            throw new BadRequestException(`Cannot resume order with current status '${order.status}'`);
        }

        const updated = await this.orderRepo.update(orderId, { status: OrderStatus.ACTIVE });
        this.eventEmitter.emit('order.resumed', { orderId });
        return updated!;
    }

    async transitionToCancelled(orderId: string, reason?: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID '${orderId}' not found`);
        }

        const updated = await this.orderRepo.update(orderId, { status: OrderStatus.CANCELLED });
        this.eventEmitter.emit('order.cancelled', { orderId, reason });
        return updated!;
    }
}
