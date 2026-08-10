import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    ForbiddenException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderRepository } from '../../../../shared/database/repositories/order.repository';
import { TaskRepository } from '../../../../shared/database/repositories/task.repository';
import { SubmissionRepository } from '../../../../shared/database/repositories/submission.repository';
import { TaskEngineService } from '../../../../task-engine/task-engine.service';
import { ProgressEngineService } from '../../../../progress-engine/progress.service';
import { PricingEngineService } from '../../../../shared/services/pricing-engine.service';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import { UserRole, User } from '../../../../shared/database/entities/user.entity';

@ApiTags('Buyer - Orders')
@Roles(UserRole.BUYER)
@ApiBearerAuth('bearer')
@Controller('buyer/orders')
export class BuyerOrderController {
    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly taskRepo: TaskRepository,
        private readonly submissionRepo: SubmissionRepository,
        private readonly taskEngine: TaskEngineService,
        private readonly progressEngine: ProgressEngineService,
        private readonly pricingEngine: PricingEngineService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new campaign order with price snapshotting' })
    async createOrder(
        @CurrentUser() user: User,
        @Body()
        data: {
            title: string;
            description?: string;
            taskType: string;
            totalTasksRequired: number;
            requirements?: any;
            reviewMode?: string;
        },
    ) {
        if (!data.title || !data.taskType || !data.totalTasksRequired) {
            throw new BadRequestException('title, taskType, and totalTasksRequired are required');
        }

        let priceSnapshot: any = null;
        try {
            priceSnapshot = await this.pricingEngine.calculatePriceSnapshot(
                data.taskType.toUpperCase(),
                data.totalTasksRequired,
            );
        } catch {
            // Fallback if catalog not populated yet
            priceSnapshot = {
                buyerUnitPrice: 10,
                workerReward: 6,
                platformMargin: 4,
                pricingVersion: 1,
                totalOrderAmount: 10 * data.totalTasksRequired,
            };
        }

        const order = await this.orderRepo.create({
            buyerId: user.id,
            title: data.title,
            description: data.description,
            taskType: data.taskType,
            totalTasksRequired: data.totalTasksRequired,
            rewardPerTask: priceSnapshot.workerReward,
            buyerUnitPrice: priceSnapshot.buyerUnitPrice,
            workerRewardSnapshot: priceSnapshot.workerReward,
            platformMarginSnapshot: priceSnapshot.platformMargin,
            serviceCode: data.taskType,
            pricingVersion: priceSnapshot.pricingVersion,
            totalAmount: priceSnapshot.totalOrderAmount,
            status: 'ACTIVE',
            requirements: data.requirements,
            reviewMode: data.reviewMode || 'buyer',
        });

        // Generate individual tasks for order
        for (let i = 0; i < data.totalTasksRequired; i++) {
            await this.taskEngine.createTask({
                orderId: order.id,
                campaignId: order.id,
                taskType: data.taskType,
                requirements: data.requirements,
                rewardAmount: priceSnapshot.workerReward,
            });
        }

        return {
            success: true,
            order,
            priceSnapshot,
            message: 'Order created successfully and price snapshot locked',
        };
    }

    @Get()
    @ApiOperation({ summary: 'List orders created by buyer' })
    async getOrders(@CurrentUser() user: User) {
        const orders = await this.orderRepo.findByBuyer(user.id);
        return {
            success: true,
            orders,
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get order details' })
    async getOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        return {
            success: true,
            order,
        };
    }

    @Get(':id/progress')
    @ApiOperation({ summary: 'Get order progress and completion metrics' })
    async getOrderProgress(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const progress = await this.progressEngine.getOrderProgress(orderId);
        return {
            success: true,
            progress,
        };
    }

    @Get(':id/tasks')
    @ApiOperation({ summary: 'Get all tasks associated with order' })
    async getOrderTasks(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);
        return {
            success: true,
            tasks,
            count: tasks.length,
        };
    }

    @Get(':id/completed')
    @ApiOperation({ summary: 'Get completed tasks for order' })
    async getCompletedTasks(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);
        const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'approved');

        return {
            success: true,
            tasks: completed,
            count: completed.length,
        };
    }

    @Get(':id/pending')
    @ApiOperation({ summary: 'Get pending tasks for order' })
    async getPendingTasks(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);
        const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'submitted');

        return {
            success: true,
            tasks: pending,
            count: pending.length,
        };
    }

    @Get(':id/rejected')
    @ApiOperation({ summary: 'Get rejected tasks for order' })
    async getRejectedTasks(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);
        const rejected = tasks.filter((t) => t.status === 'rejected');

        return {
            success: true,
            tasks: rejected,
            count: rejected.length,
        };
    }

    @Get(':id/activity')
    @ApiOperation({ summary: 'Get order activity timeline' })
    async getOrderActivity(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);

        return {
            success: true,
            orderId: order.id,
            activity: [
                { type: 'ORDER_CREATED', timestamp: order.createdAt, detail: `Order created with ${order.totalTasksRequired} tasks` },
                { type: 'TASKS_GENERATED', timestamp: order.createdAt, detail: `${tasks.length} individual tasks queued` },
            ],
        };
    }

    @Get(':id/analytics')
    @ApiOperation({ summary: 'Get detailed order analytics' })
    async getOrderAnalytics(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        const progress = await this.progressEngine.getOrderProgress(orderId);

        return {
            success: true,
            analytics: {
                orderId: order.id,
                totalRequired: order.totalTasksRequired,
                completedCount: order.tasksCompleted,
                completionRatePercentage: progress.completionRate * 100,
                unitPrice: order.buyerUnitPrice || order.rewardPerTask,
                totalAmountSpent: (order.buyerUnitPrice || order.rewardPerTask) * order.tasksCompleted,
            },
        };
    }

    @Post(':id/pause')
    @ApiOperation({ summary: 'Pause order campaign' })
    async pauseOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        if (order.status !== 'ACTIVE') {
            throw new BadRequestException(`Cannot pause order with status ${order.status}`);
        }

        await this.orderRepo.update(orderId, { status: 'PAUSED' });
        return {
            success: true,
            message: 'Order paused successfully',
        };
    }

    @Post(':id/resume')
    @ApiOperation({ summary: 'Resume paused order campaign' })
    async resumeOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        if (order.status !== 'PAUSED') {
            throw new BadRequestException(`Cannot resume order with status ${order.status}`);
        }

        await this.orderRepo.update(orderId, { status: 'ACTIVE' });
        return {
            success: true,
            message: 'Order resumed successfully',
        };
    }

    @Post(':id/cancel')
    @ApiOperation({ summary: 'Cancel order' })
    async cancelOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order || order.buyerId !== user.id) {
            throw new NotFoundException('Order not found or access denied');
        }

        await this.orderRepo.update(orderId, { status: 'CANCELLED' });
        return {
            success: true,
            message: 'Order cancelled',
        };
    }
}
