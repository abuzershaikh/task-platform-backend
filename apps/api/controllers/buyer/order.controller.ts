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
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new campaign order and generate tasks' })
    async createOrder(
        @CurrentUser() user: User,
        @Body()
        data: {
            title: string;
            description?: string;
            taskType: string;
            totalTasksRequired: number;
            rewardPerTask: number;
            requirements?: any;
            reviewMode?: string;
        },
    ) {
        if (!data.title || !data.taskType || !data.totalTasksRequired || !data.rewardPerTask) {
            throw new BadRequestException('title, taskType, totalTasksRequired, and rewardPerTask are required');
        }

        const order = await this.orderRepo.create({
            buyerId: user.id,
            title: data.title,
            description: data.description,
            taskType: data.taskType,
            totalTasksRequired: data.totalTasksRequired,
            rewardPerTask: data.rewardPerTask,
            status: 'active',
            requirements: data.requirements,
            reviewMode: data.reviewMode || 'buyer',
        });

        // Generate tasks for order
        for (let i = 0; i < data.totalTasksRequired; i++) {
            await this.taskEngine.createTask({
                orderId: order.id,
                campaignId: order.id,
                taskType: data.taskType,
                requirements: data.requirements,
                rewardAmount: data.rewardPerTask,
            });
        }

        return {
            success: true,
            order,
            message: 'Order created successfully and tasks queued',
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
    @ApiOperation({ summary: 'Get order details with ownership validation' })
    async getOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to this order');
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
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to this order');
        }

        const progress = await this.progressEngine.getOrderProgress(orderId);
        return {
            success: true,
            progress,
        };
    }

    @Get(':id/submissions')
    @ApiOperation({ summary: 'Get submissions for a specific order' })
    async getOrderSubmissions(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to this order');
        }

        const tasks = await this.taskRepo.findByOrderId(orderId);
        const taskIds = tasks.map((t) => t.id);

        let submissions: any[] = [];
        for (const taskId of taskIds) {
            const sub = await this.submissionRepo.findByTaskId(taskId);
            if (sub) {
                submissions.push(sub);
            }
        }

        return {
            success: true,
            submissions,
        };
    }

    @Post(':id/cancel')
    @ApiOperation({ summary: 'Cancel active order' })
    async cancelOrder(@Param('id') orderId: string, @CurrentUser() user: User) {
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.buyerId !== user.id) {
            throw new ForbiddenException('You do not have access to this order');
        }

        await this.orderRepo.update(orderId, {
            status: 'cancelled',
        });

        return {
            success: true,
            message: 'Order cancelled',
        };
    }
}
